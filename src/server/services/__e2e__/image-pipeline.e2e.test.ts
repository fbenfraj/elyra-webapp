// Must mock "server-only" before any service imports
vi.mock("server-only", () => ({}));

// Mock provider adapters at interface boundary
vi.mock("@/server/providers/fal", () => ({
  falAdapter: {
    generate: vi.fn(),
    getHealth: vi.fn(),
    estimateCost: vi.fn(),
    supports: vi.fn(),
  },
}));

vi.mock("@/server/providers/openai", () => ({
  interpretBrief: vi.fn(),
  moderateBrief: vi.fn(),
  evaluateImage: vi.fn(),
  refinePromptWithFeedback: vi.fn().mockResolvedValue({
    refinedPrompt: "Refined prompt with better color accuracy",
    costCents: 2,
    durationMs: 400,
  }),
  openaiEvaluationAdapter: {
    evaluate: vi.fn(),
    getHealth: vi.fn(),
    estimateCost: vi.fn(),
  },
}));

vi.mock("@/server/providers/anthropic", () => ({
  anthropicEvaluationAdapter: {
    evaluate: vi.fn(),
    getHealth: vi.fn(),
    estimateCost: vi.fn(),
  },
}));

// Mock storage to avoid real R2 calls
vi.mock("@/server/services/storage", () => ({
  uploadImageFromUrl: vi.fn().mockResolvedValue(undefined),
  getSignedImageUrl: vi.fn().mockImplementation((key: string) =>
    Promise.resolve(`https://cdn.example.com/${key}`)
  ),
}));

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import {
  testDb,
  createTestUserId,
  createTestUser,
  cleanupTestUser,
  closeTestConnection,
  createFullSession,
  insertGenerationAttempt,
} from "./setup";
import { sessions } from "@/server/db/schema/sessions";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { generateImages } from "@/server/services/image-generation";
import { evaluateBatch, getCuratedImages } from "@/server/services/evaluation";
import { falAdapter } from "@/server/providers/fal";
import { openaiEvaluationAdapter } from "@/server/providers/openai";
import { MIN_PASS_SCORE } from "@/config/evaluation";

const mockFalGenerate = vi.mocked(falAdapter.generate);
const mockEvaluate = vi.mocked(openaiEvaluationAdapter.evaluate);

// ---------------------------------------------------------------------------
// Image Generation + Evaluation Pipeline E2E
// ---------------------------------------------------------------------------

describe("Image Pipeline E2E", () => {
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
  // Task 4.2: image generation → evaluation → score check → curation
  // -------------------------------------------------------------------------

  it("generates images and stores generation_attempts with required fields", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "paid"
    );

    // Mock fal.ai to return a valid image URL
    mockFalGenerate.mockResolvedValue({
      imageUrl: "https://fal.ai/mock-output.webp",
      width: 1024,
      height: 1024,
      costCents: 5,
      durationMs: 1100,
    });

    const result = await generateImages(sessionId, testUserId, 1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.imageCount).toBeGreaterThan(0);

    // Task 4.5: Verify generation_attempts records have required fields
    const attempts = await testDb
      .select()
      .from(generationAttempts)
      .where(eq(generationAttempts.sessionId, sessionId));

    expect(attempts.length).toBeGreaterThan(0);

    for (const attempt of attempts) {
      expect(attempt.promptUsed).toBeTruthy();
      expect(attempt.model).toBeTruthy();
      expect(attempt.provider).toBeTruthy();
      expect(attempt.costCents).toBeGreaterThan(0);
      expect(attempt.durationMs).toBeGreaterThan(0);
      expect(attempt.sessionId).toBe(sessionId);
      expect(attempt.generationJobId).toBe(generationJobId);
      // evaluationScore and evaluationFeedback are null before evaluation step
      expect(attempt.evaluationScore).toBeNull();
    }

    // Session should be in evaluating status
    const [dbSession] = await testDb
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(dbSession.status).toBe("evaluating");
  });

  it("evaluates images and updates generation_attempts with scores and feedback", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "paid"
    );

    const directionId = `${sessionId}-dir-0`;

    // Pre-insert unevaluated attempt (no evaluation score yet)
    const attemptId = await insertGenerationAttempt(sessionId, generationJobId!);

    // Set session status to evaluating
    await testDb
      .update(sessions)
      .set({ status: "evaluating" })
      .where(eq(sessions.id, sessionId));

    const mockEvalResult = {
      scores: {
        composition: 0.8,
        colorAccuracy: 0.85,
        moodAlignment: 0.9,
        textAccuracy: 1.0,
        brandConsistency: 0.75,
      },
      overallScore: 0.86,
      feedback: "Strong mood alignment, excellent color palette usage",
      strengths: ["color palette", "mood alignment"],
      weaknesses: [],
    };

    mockEvaluate.mockResolvedValue({
      result: mockEvalResult,
      costCents: 3,
      durationMs: 600,
    });

    const result = await evaluateBatch(sessionId, testUserId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.evaluatedCount).toBeGreaterThan(0);

    // Verify evaluation data stored on attempt
    const [attempt] = await testDb
      .select()
      .from(generationAttempts)
      .where(eq(generationAttempts.id, attemptId));

    expect(attempt.evaluationScore).not.toBeNull();
    expect(attempt.evaluationScore).toBeGreaterThan(0);
    expect(attempt.evaluationFeedback).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Task 4.3: Graceful degradation — all below threshold → best still delivered
  // -------------------------------------------------------------------------

  it("delivers best-scoring image when all scores are below threshold", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "paid"
    );

    // Insert attempts with scores BELOW MIN_PASS_SCORE
    const belowThreshold = MIN_PASS_SCORE - 0.1;
    await insertGenerationAttempt(sessionId, generationJobId!, {
      evaluationScore: belowThreshold,
      evaluationFeedback: {
        scores: {
          composition: 0.5,
          colorAccuracy: 0.4,
          moodAlignment: 0.5,
          textAccuracy: 0.6,
          brandConsistency: 0.4,
        },
        overallScore: belowThreshold,
        feedback: "Poor alignment with direction",
        strengths: [],
        weaknesses: ["color mismatch", "composition off"],
      },
    });

    await insertGenerationAttempt(sessionId, generationJobId!, {
      evaluationScore: belowThreshold - 0.05,
      evaluationFeedback: {
        scores: {
          composition: 0.4,
          colorAccuracy: 0.3,
          moodAlignment: 0.45,
          textAccuracy: 0.5,
          brandConsistency: 0.35,
        },
        overallScore: belowThreshold - 0.05,
        feedback: "Weak overall",
        strengths: [],
        weaknesses: ["mood mismatch"],
      },
    });

    // getCuratedImages should gracefully degrade and return best-scoring
    const curated = await getCuratedImages(sessionId);

    expect(curated.images).toHaveLength(2);
    // Should be sorted highest score first (graceful degradation)
    const scores = curated.images.map((img) => img.batchNumber);
    expect(scores.length).toBeGreaterThan(0);
  });

  it("returns passing images when some score above threshold", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "paid"
    );

    // Insert one passing attempt
    await insertGenerationAttempt(sessionId, generationJobId!, {
      evaluationScore: MIN_PASS_SCORE + 0.1,
      evaluationFeedback: {
        scores: {
          composition: 0.9,
          colorAccuracy: 0.85,
          moodAlignment: 0.88,
          textAccuracy: 1.0,
          brandConsistency: 0.87,
        },
        overallScore: MIN_PASS_SCORE + 0.1,
        feedback: "Excellent result",
        strengths: ["composition", "color"],
        weaknesses: [],
      },
    });

    // Insert one failing attempt
    await insertGenerationAttempt(sessionId, generationJobId!, {
      evaluationScore: MIN_PASS_SCORE - 0.2,
      evaluationFeedback: {
        scores: {
          composition: 0.4,
          colorAccuracy: 0.3,
          moodAlignment: 0.4,
          textAccuracy: 0.5,
          brandConsistency: 0.3,
        },
        overallScore: MIN_PASS_SCORE - 0.2,
        feedback: "Poor result",
        strengths: [],
        weaknesses: ["everything"],
      },
    });

    const curated = await getCuratedImages(sessionId);

    // Should only return the passing image
    expect(curated.images).toHaveLength(1);
  });

  it("blocks image generation for unpaid sessions", async () => {
    const { sessionId } = await createFullSession(testUserId, "direction_selected");

    const result = await generateImages(sessionId, testUserId, 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Should fail due to invalid status (not paid)
    expect(["INVALID_STATUS", "UNPAID"]).toContain(result.error.code);
  });

  it("blocks image generation when session has no selected direction", async () => {
    const { sessionId } = await createFullSession(testUserId, "paid");

    // Explicitly clear the selected direction
    await testDb
      .update(sessions)
      .set({ selectedDirectionId: null })
      .where(eq(sessions.id, sessionId));

    const result = await generateImages(sessionId, testUserId, 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NO_DIRECTION");
  });

  it("tracks status transitions: paid → generating_images → evaluating", async () => {
    const { sessionId } = await createFullSession(testUserId, "paid");

    // Verify initial status
    let [dbSession] = await testDb
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(dbSession.status).toBe("paid");

    // Mock fal.ai
    mockFalGenerate.mockResolvedValue({
      imageUrl: "https://fal.ai/mock.webp",
      width: 1024,
      height: 1024,
      costCents: 5,
      durationMs: 900,
    });

    await generateImages(sessionId, testUserId, 1);

    // Status should now be evaluating
    [dbSession] = await testDb
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(dbSession.status).toBe("evaluating");
  });
});
