import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// --- DB mock tracking ---
let selectCallIndex = 0;
const selectResults: unknown[][] = [];
const updateCalls: { set: unknown; where: unknown }[] = [];

function resetDbMocks() {
  selectCallIndex = 0;
  selectResults.length = 0;
  updateCalls.length = 0;
}

function addSelectResult(rows: unknown[]) {
  selectResults.push(rows);
}

function buildSelectChain() {
  const idx = selectCallIndex++;
  const terminal = () => Promise.resolve(selectResults[idx] ?? []);
  const chainable: Record<string, unknown> = {};
  const whereResult = {
    orderBy: () => ({
      limit: () => terminal(),
      then: (resolve: (v: unknown) => void) => terminal().then(resolve),
      catch: (reject: (v: unknown) => void) => terminal().catch(reject),
    }),
    then: (resolve: (v: unknown) => void) => terminal().then(resolve),
    catch: (reject: (v: unknown) => void) => terminal().catch(reject),
  };
  chainable.from = () => chainable;
  chainable.where = () => whereResult;
  return chainable;
}

vi.mock("@/server/db", () => ({
  db: {
    select: () => buildSelectChain(),
    update: () => ({
      set: (vals: unknown) => ({
        where: (w: unknown) => {
          updateCalls.push({ set: vals, where: w });
          return Promise.resolve();
        },
      }),
    }),
  },
}));

vi.mock("@/server/db/schema/generation-attempts", () => ({
  generationAttempts: {
    id: "id",
    sessionId: "session_id",
    imageKey: "image_key",
    evaluationScore: "evaluation_score",
    evaluationFeedback: "evaluation_feedback",
    batchNumber: "batch_number",
    promptUsed: "prompt_used",
    createdAt: "created_at",
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
    selectedDirectionId: "selected_direction_id",
    selectedGenerationJobId: "selected_generation_job_id",
  },
}));

vi.mock("@/server/db/schema/generation-jobs", () => ({
  generationJobs: {
    id: "id",
    sessionId: "session_id",
    directionData: "direction_data",
    visualSpecId: "visual_spec_id",
    createdAt: "created_at",
  },
}));

vi.mock("@/server/db/schema/visual-specs", () => ({
  visualSpecs: {
    id: "id",
    specData: "spec_data",
  },
}));

// --- Mock OpenAI evaluateImage ---
const mockEvaluateImage = vi.fn();
vi.mock("@/server/providers/openai", () => ({
  evaluateImage: (...args: unknown[]) => mockEvaluateImage(...args),
}));

// --- Mock storage ---
const mockGetSignedImageUrl = vi.fn();
vi.mock("@/server/services/storage", () => ({
  getSignedImageUrl: (...args: unknown[]) => mockGetSignedImageUrl(...args),
}));

// --- Mock config ---
vi.mock("@/config/evaluation", () => ({
  RUBRIC_WEIGHTS: {
    composition: 0.25,
    colorAccuracy: 0.2,
    moodAlignment: 0.2,
    textAccuracy: 0.2,
    brandConsistency: 0.15,
  },
  MIN_PASS_SCORE: 0.7,
  MAX_EVAL_RETRIES: 3,
}));

const MOCK_DIRECTION_DATA = {
  directions: [
    {
      id: "dir-0",
      heroImageKey: "hero.webp",
      moodLabel: "Dark cinematic",
      tags: ["moody"],
      supportingImageKeys: [],
      colorPalette: ["#000000", "#111111"],
      description: "A dark cinematic direction",
    },
  ],
};

function makeEvalResult(overallScore: number, composition = 0.8, colorAccuracy = 0.8, moodAlignment = 0.8, textAccuracy = 0.8, brandConsistency = 0.8) {
  return {
    result: {
      scores: { composition, colorAccuracy, moodAlignment, textAccuracy, brandConsistency },
      overallScore,
      feedback: "Good image",
      strengths: ["Good composition"],
      weaknesses: ["Slightly off palette"],
    },
    costCents: 1,
    durationMs: 500,
  };
}

function setupDirectionContext() {
  // Session lookup
  addSelectResult([
    {
      selectedDirectionId: "dir-0",
      selectedGenerationJobId: "job-1",
    },
  ]);
  // Generation job lookup
  addSelectResult([
    {
      id: "job-1",
      directionData: MOCK_DIRECTION_DATA,
      visualSpecId: "spec-1",
    },
  ]);
  // Visual spec lookup
  addSelectResult([
    {
      specData: { mood: "dark cinematic", style: "photographic", composition: "centered" },
    },
  ]);
}

describe("evaluation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    mockGetSignedImageUrl.mockResolvedValue("https://signed.url/image.webp");
  });

  describe("evaluateBatch", () => {
    it("evaluates batch and stores scores in generation_attempts", async () => {
      setupDirectionContext();
      // Unevaluated attempts
      addSelectResult([
        { id: "attempt-1", imageKey: "sessions/s1/attempts/a1.webp" },
        { id: "attempt-2", imageKey: "sessions/s1/attempts/a2.webp" },
      ]);

      mockEvaluateImage.mockResolvedValue(makeEvalResult(0.85));

      const { evaluateBatch } = await import("@/server/services/evaluation");
      const result = await evaluateBatch("session-1", "user-1");

      expect(result.ok).toBe(true);
      expect(result.output?.evaluatedCount).toBe(2);
      expect(mockEvaluateImage).toHaveBeenCalledTimes(2);
      expect(updateCalls.length).toBe(2);
    });

    it("computes weighted overall score correctly from rubric", async () => {
      setupDirectionContext();
      addSelectResult([
        { id: "attempt-1", imageKey: "sessions/s1/attempts/a1.webp" },
      ]);

      // Return specific scores to verify weighted calculation
      // composition=0.8*0.25 + colorAccuracy=0.6*0.20 + moodAlignment=0.9*0.20 + textAccuracy=0.7*0.20 + brandConsistency=0.5*0.15
      // = 0.20 + 0.12 + 0.18 + 0.14 + 0.075 = 0.715
      mockEvaluateImage.mockResolvedValue(
        makeEvalResult(0.715, 0.8, 0.6, 0.9, 0.7, 0.5)
      );

      const { evaluateBatch } = await import("@/server/services/evaluation");
      const result = await evaluateBatch("session-1", "user-1");

      expect(result.ok).toBe(true);
      expect(result.output?.passingCount).toBe(1); // 0.715 >= 0.7

      // Verify the stored score is the weighted score
      const storedScore = (updateCalls[0]?.set as { evaluationScore: number })?.evaluationScore;
      expect(storedScore).toBeCloseTo(0.715, 3);
    });
  });

  describe("getCuratedImages", () => {
    it("returns only passing images ranked by score", async () => {
      // getCuratedImages does a single select query
      addSelectResult([
        { id: "a1", imageKey: "key1.webp", evaluationScore: 0.9, batchNumber: 1 },
        { id: "a2", imageKey: "key2.webp", evaluationScore: 0.75, batchNumber: 1 },
        { id: "a3", imageKey: "key3.webp", evaluationScore: 0.5, batchNumber: 1 },
      ]);

      mockGetSignedImageUrl.mockImplementation((key: string) =>
        Promise.resolve(`https://signed.url/${key}`)
      );

      const { getCuratedImages } = await import("@/server/services/evaluation");
      const { images } = await getCuratedImages("session-1");

      // Only 2 pass threshold (0.7): a1 (0.9) and a2 (0.75)
      expect(images.length).toBe(2);
      expect(images[0]?.id).toBe("a1");
      expect(images[1]?.id).toBe("a2");
      // No scores in response
      expect(images[0]).not.toHaveProperty("evaluationScore");
    });

    it("returns best-scoring when none pass threshold (graceful degradation)", async () => {
      addSelectResult([
        { id: "a1", imageKey: "key1.webp", evaluationScore: 0.6, batchNumber: 1 },
        { id: "a2", imageKey: "key2.webp", evaluationScore: 0.5, batchNumber: 2 },
        { id: "a3", imageKey: "key3.webp", evaluationScore: 0.4, batchNumber: 2 },
      ]);

      mockGetSignedImageUrl.mockImplementation((key: string) =>
        Promise.resolve(`https://signed.url/${key}`)
      );

      const { getCuratedImages } = await import("@/server/services/evaluation");
      const { images } = await getCuratedImages("session-1");

      // None pass 0.7, so return all ranked by score descending
      expect(images.length).toBe(3);
      expect(images[0]?.id).toBe("a1"); // highest score
    });

    it("returns images from ALL batches (cumulative)", async () => {
      addSelectResult([
        { id: "a1", imageKey: "key1.webp", evaluationScore: 0.9, batchNumber: 1 },
        { id: "a2", imageKey: "key2.webp", evaluationScore: 0.85, batchNumber: 2 },
        { id: "a3", imageKey: "key3.webp", evaluationScore: 0.8, batchNumber: 3 },
      ]);

      mockGetSignedImageUrl.mockImplementation((key: string) =>
        Promise.resolve(`https://signed.url/${key}`)
      );

      const { getCuratedImages } = await import("@/server/services/evaluation");
      const { images } = await getCuratedImages("session-1");

      // All pass, and come from 3 different batches
      expect(images.length).toBe(3);
      const batches = images.map((i) => i.batchNumber);
      expect(batches).toContain(1);
      expect(batches).toContain(2);
      expect(batches).toContain(3);
    });
  });

  describe("getBatchCount", () => {
    it("counts distinct batch numbers for retry tracking", async () => {
      addSelectResult([
        { batchNumber: 1 },
        { batchNumber: 1 },
        { batchNumber: 2 },
        { batchNumber: 2 },
        { batchNumber: 3 },
      ]);

      const { getBatchCount } = await import("@/server/services/evaluation");
      const count = await getBatchCount("session-1");

      expect(count).toBe(3);
    });

    it("stops retry loop at MAX_EVAL_RETRIES", async () => {
      // When batchCount >= MAX_EVAL_RETRIES (3), no more retries should happen
      addSelectResult([
        { batchNumber: 1 },
        { batchNumber: 2 },
        { batchNumber: 3 },
      ]);

      const { getBatchCount } = await import("@/server/services/evaluation");
      const { MAX_EVAL_RETRIES } = await import("@/config/evaluation");
      const count = await getBatchCount("session-1");

      expect(count).toBeGreaterThanOrEqual(MAX_EVAL_RETRIES);
    });
  });
});

// Mock all transitive imports of image-generation.ts to avoid Stripe init
const mockRefinePromptWithFeedback = vi.fn();
vi.mock("@/server/providers/openai", () => ({
  evaluateImage: (...args: unknown[]) => mockEvaluateImage(...args),
  refinePromptWithFeedback: (...args: unknown[]) => mockRefinePromptWithFeedback(...args),
}));

vi.mock("@/server/providers/fal", () => ({
  falAdapter: { generate: vi.fn() },
}));

vi.mock("@/server/services/session", () => ({
  updateSessionStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/services/payment", () => ({
  checkPackBoundary: vi.fn().mockResolvedValue({ isPaid: true, canRegenerate: true }),
}));

describe("refinePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    mockRefinePromptWithFeedback.mockReset();
  });

  it("incorporates weakness feedback into new prompt", async () => {
    // Latest attempt prompt lookup
    addSelectResult([
      { promptUsed: "A dark cinematic album cover with urban vibes." },
    ]);

    mockRefinePromptWithFeedback.mockResolvedValue({
      refinedPrompt: "A dark cinematic album cover with deep shadows, urban isolation, specific hex #000000 #111111 palette.",
      costCents: 0.5,
      durationMs: 300,
    });

    const { refinePrompt } = await import("@/server/services/image-generation");
    const feedback = [
      {
        scores: {
          composition: 0.8,
          colorAccuracy: 0.3,
          moodAlignment: 0.7,
          textAccuracy: 0.9,
          brandConsistency: 0.6,
        },
        overallScore: 0.65,
        feedback: "Color palette doesn't match target",
        strengths: ["Good composition"],
        weaknesses: ["Color palette far from target", "Brand consistency weak"],
      },
    ];

    const result = await refinePrompt("session-1", feedback);

    expect(result.ok).toBe(true);
    expect(result.output?.refinedPrompt).toContain("dark cinematic");
  });
});
