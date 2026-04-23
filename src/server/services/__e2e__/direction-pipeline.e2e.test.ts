// Must mock "server-only" before any service imports
vi.mock("server-only", () => ({}));

// Mock provider adapters at the interface boundary
vi.mock("@/server/providers/openai", () => ({
  interpretBrief: vi.fn(),
  moderateBrief: vi.fn(),
  evaluateImage: vi.fn(),
  refinePromptWithFeedback: vi.fn(),
  openaiEvaluationAdapter: {
    evaluate: vi.fn(),
    getHealth: vi.fn(),
    estimateCost: vi.fn(),
  },
}));

vi.mock("@/server/providers/fal", () => ({
  falAdapter: {
    generate: vi.fn(),
    getHealth: vi.fn(),
    estimateCost: vi.fn(),
    supports: vi.fn(),
  },
}));

// Mock storage to avoid real R2 calls
vi.mock("@/server/services/storage", () => ({
  uploadImageFromUrl: vi.fn().mockResolvedValue(undefined),
  getSignedImageUrl: vi.fn().mockImplementation((key: string) =>
    Promise.resolve(`https://cdn.example.com/${key}`)
  ),
}));

// Mock generateObject from "ai" (used in direction-generation.ts)
vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

// Mock @ai-sdk/openai
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn().mockReturnValue("mock-openai-model"),
}));

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  testDb,
  createTestUserId,
  createTestUser,
  cleanupTestUser,
  closeTestConnection,
  MOCK_VISUAL_SPEC,
  insertVisualSpec,
} from "./setup";
import { sessions } from "@/server/db/schema/sessions";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { createSession } from "@/server/services/session";
import { runInterpretation } from "@/server/services/interpretation";
import { generateDirections } from "@/server/services/direction-generation";
import { storeVisualSpec } from "@/server/services/visual-spec-store";
import { interpretBrief, moderateBrief } from "@/server/providers/openai";
import { falAdapter } from "@/server/providers/fal";
import { generateObject } from "ai";

const mockInterpretBrief = vi.mocked(interpretBrief);
const mockModerateBrief = vi.mocked(moderateBrief);
const mockFalGenerate = vi.mocked(falAdapter.generate);
const mockGenerateObject = vi.mocked(generateObject);

// ---------------------------------------------------------------------------
// Direction Generation Pipeline E2E
// ---------------------------------------------------------------------------

describe("Direction Pipeline E2E", () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = createTestUserId();
    await createTestUser(testUserId);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  // -------------------------------------------------------------------------
  // Task 3.2: brief → interpretation → visual spec stored → generation jobs
  // -------------------------------------------------------------------------

  it("runs interpretation and stores visual spec in DB", async () => {
    const session = await createSession(testUserId, "dark trap nighttime city vibes");

    // Mock moderation to pass
    mockModerateBrief.mockResolvedValue({ flagged: false, categories: [] });

    // Mock LLM interpretation via executeWithFallback (which calls interpretBrief)
    mockInterpretBrief.mockResolvedValue({
      response: {
        confidence: 0.9,
        followUpQuestions: [],
        spec: MOCK_VISUAL_SPEC,
      },
      costCents: 2,
      durationMs: 500,
    });

    const result = await runInterpretation(
      session.id,
      testUserId,
      "dark trap nighttime city vibes"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.type).toBe("spec");

    // Verify session status advanced to generating_directions
    const [dbSession] = await testDb
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("generating_directions");

    // Verify visual spec stored in DB
    const specs = await testDb
      .select()
      .from(visualSpecs)
      .where(eq(visualSpecs.sessionId, session.id));

    expect(specs).toHaveLength(1);
    const spec = specs[0];
    expect(spec.sessionId).toBe(session.id);
    expect(spec.specData).toBeDefined();

    // Task 3.4: Verify visual spec schema matches Zod validation
    const { visualSpecSchema } = await import("@/lib/schemas/visual-spec");
    const parsed = visualSpecSchema.safeParse(spec.specData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.genreContext).toBe(MOCK_VISUAL_SPEC.genreContext);
      expect(parsed.data.mood).toBe(MOCK_VISUAL_SPEC.mood);
    }
  });

  it("returns follow-up questions when confidence is below threshold", async () => {
    const session = await createSession(testUserId, "vibes");

    mockModerateBrief.mockResolvedValue({ flagged: false, categories: [] });

    mockInterpretBrief.mockResolvedValue({
      response: {
        confidence: 0.4,
        followUpQuestions: ["More gritty or more polished?", "Any artist that captures this feeling?"],
        spec: undefined,
      },
      costCents: 1,
      durationMs: 300,
    });

    const result = await runInterpretation(session.id, testUserId, "vibes");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.type).toBe("follow_up");

    // Session should revert to pending
    const [dbSession] = await testDb
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("pending");

    // No visual spec should be stored
    const specs = await testDb
      .select()
      .from(visualSpecs)
      .where(eq(visualSpecs.sessionId, session.id));
    expect(specs).toHaveLength(0);
  });

  it("blocks flagged briefs and does NOT advance session status", async () => {
    const session = await createSession(testUserId, "violent offensive content");

    mockModerateBrief.mockResolvedValue({
      flagged: true,
      categories: ["violence/graphic"],
    });

    const result = await runInterpretation(
      session.id,
      testUserId,
      "violent offensive content"
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONTENT_POLICY");

    // Session stays in pending
    const [dbSession] = await testDb
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("pending");
  });

  it("stores direction data in generation_jobs with correct foreign keys", async () => {
    const session = await createSession(testUserId, "lo-fi hip hop beats");

    // Advance to generating_directions
    await testDb
      .update(sessions)
      .set({ status: "generating_directions" })
      .where(eq(sessions.id, session.id));

    // Store visual spec
    const visualSpecId = await insertVisualSpec(session.id);

    // Mock direction LLM prompt generation
    mockGenerateObject.mockResolvedValue({
      object: {
        directions: [
          {
            approach: "literal",
            moodLabel: "Soft lo-fi / pastel afternoons",
            tags: ["soft", "lo-fi", "cozy"],
            colorPalette: ["#f9dcc4", "#fec89a", "#d4a5a5", "#a0c4ff", "#caffbf"],
            description: "Warm, soft imagery with vintage textures and muted pastels",
            imagePrompt:
              "Soft lo-fi bedroom, vintage records, warm afternoon light, pastel colors, cozy atmosphere",
          },
          {
            approach: "conceptual",
            moodLabel: "Dreamy escapism",
            tags: ["dreamy", "abstract", "ethereal"],
            colorPalette: ["#e0c3fc", "#8ec5fc", "#d4a5a5", "#a0c4ff", "#fdffb6"],
            description: "Abstract shapes and dreamlike imagery suggesting a state of peace",
            imagePrompt:
              "Abstract dreamscape, floating shapes, soft gradients, ethereal atmosphere, studio ghibli vibes",
          },
        ],
      },
      usage: { inputTokens: 100, outputTokens: 200 },
      finishReason: "stop",
      warnings: [],
    } as unknown as Awaited<ReturnType<typeof generateObject>>);

    // Mock fal adapter for image generation
    mockFalGenerate.mockResolvedValue({
      imageUrl: "https://fal.ai/mock-image.webp",
      width: 1024,
      height: 1024,
      costCents: 1,
      durationMs: 800,
    });

    const result = await generateDirections(session.id, testUserId, visualSpecId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output).toHaveLength(2);

    // Task 3.5: Verify generation_jobs records have correct foreign keys
    const jobs = await testDb
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.sessionId, session.id));

    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    expect(job.sessionId).toBe(session.id);
    expect(job.visualSpecId).toBe(visualSpecId);
    expect(job.status).toBe("complete");

    // Verify direction data structure
    const directionData = job.directionData as {
      directions: Array<{ id: string; moodLabel: string; tags: string[] }>;
    };
    expect(directionData.directions).toHaveLength(2);
    expect(directionData.directions[0].moodLabel).toBe("Soft lo-fi / pastel afternoons");
    expect(directionData.directions[0].tags).toHaveLength(3);

    // Session should be in complete/selecting status
    const [dbSession] = await testDb
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(["complete", "selecting"]).toContain(dbSession.status);
  });

  it("fails gracefully and sets session to failed when direction generation throws", async () => {
    const session = await createSession(testUserId, "dark ambient drone");
    await testDb
      .update(sessions)
      .set({ status: "generating_directions" })
      .where(eq(sessions.id, session.id));

    const visualSpecId = await insertVisualSpec(session.id);

    // Mock the LLM call to throw
    mockGenerateObject.mockRejectedValue(new Error("LLM service unavailable"));

    const result = await generateDirections(session.id, testUserId, visualSpecId);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DIRECTION_GENERATION_FAILED");

    const [dbSession] = await testDb
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("failed");
  });
});
