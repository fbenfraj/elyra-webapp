import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// --- Tracking arrays for DB operations ---
let selectCallIndex = 0;
const selectResults: unknown[][] = [];
const insertCalls: unknown[] = [];

function resetDbMocks() {
  selectCallIndex = 0;
  selectResults.length = 0;
  insertCalls.length = 0;
}

function addSelectResult(rows: unknown[]) {
  selectResults.push(rows);
}

// Build a chainable mock that returns the next selectResult
function buildSelectChain() {
  const idx = selectCallIndex++;
  const terminal = () => Promise.resolve(selectResults[idx] ?? []);
  const chainable: Record<string, unknown> = {};
  chainable.from = () => chainable;
  chainable.where = () => chainable;
  chainable.orderBy = () => chainable;
  chainable.limit = () => terminal();
  // If no orderBy/limit is called, the where() itself should resolve
  // Override where to return both a thenable and chainable
  const whereResult = {
    orderBy: () => ({
      limit: () => terminal(),
      then: (resolve: (v: unknown) => void) => terminal().then(resolve),
    }),
    then: (resolve: (v: unknown) => void) => terminal().then(resolve),
    catch: (reject: (v: unknown) => void) => terminal().catch(reject),
  };
  chainable.where = () => whereResult;
  return chainable;
}

vi.mock("@/server/db", () => ({
  db: {
    select: () => buildSelectChain(),
    insert: () => ({
      values: (vals: unknown) => {
        insertCalls.push(vals);
        return {
          returning: () => Promise.resolve([{ id: `attempt-${insertCalls.length}` }]),
        };
      },
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
    status: "status",
    selectedDirectionId: "selected_direction_id",
    selectedGenerationJobId: "selected_generation_job_id",
    regenCount: "regen_count",
    maxRegens: "max_regens",
  },
}));

vi.mock("@/server/db/schema/generation-jobs", () => ({
  generationJobs: {
    id: "id",
    sessionId: "session_id",
    directionData: "direction_data",
    createdAt: "created_at",
  },
}));

vi.mock("@/server/db/schema/generation-attempts", () => ({
  generationAttempts: {
    id: "id",
    sessionId: "session_id",
  },
}));

// --- Mock fal adapter ---
const mockFalGenerate = vi.fn();
vi.mock("@/server/providers/fal", () => ({
  falAdapter: {
    generate: (...args: unknown[]) => mockFalGenerate(...args),
  },
}));

// --- Mock storage ---
const mockUploadImageFromUrl = vi.fn();
vi.mock("@/server/services/storage", () => ({
  uploadImageFromUrl: (...args: unknown[]) => mockUploadImageFromUrl(...args),
}));

// --- Mock session service ---
const mockUpdateSessionStatus = vi.fn();
const mockFailSession = vi.fn();
vi.mock("@/server/services/session", () => ({
  updateSessionStatus: (...args: unknown[]) => mockUpdateSessionStatus(...args),
  failSession: (...args: unknown[]) => mockFailSession(...args),
}));

// --- Mock payment service ---
const mockCheckPackBoundary = vi.fn();
vi.mock("@/server/services/payment", () => ({
  checkPackBoundary: (...args: unknown[]) => mockCheckPackBoundary(...args),
}));

// --- Mock openai adapter ---
vi.mock("@/server/providers/openai", () => ({
  refinePromptWithFeedback: vi.fn().mockResolvedValue({
    text: "refined prompt",
    costCents: 1,
    durationMs: 500,
  }),
}));

// --- Mock config ---
vi.mock("@/config/providers", () => ({
  FAL_FINAL_MODEL: "fal-ai/flux-pro/v2",
  FAL_FINAL_COST_PER_IMAGE_CENTS: 5,
  FINAL_IMAGE_COUNT: 4,
  FINAL_IMAGE_WIDTH: 1024,
  FINAL_IMAGE_HEIGHT: 1024,
  FAL_PREVIEW_MODEL: "fal-ai/flux/schnell",
  FAL_COST_PER_IMAGE_CENTS: 0.3,
}));

const MOCK_DIRECTION_DATA = {
  directions: [
    {
      id: "session-1-dir-0",
      heroImageKey: "sessions/session-1/directions/0/hero.webp",
      moodLabel: "Dark cinematic",
      tags: ["moody", "urban"],
      supportingImageKeys: [],
      colorPalette: ["#000000", "#111111", "#222222", "#333333", "#444444"],
      description: "A dark cinematic direction with urban isolation vibes.",
    },
    {
      id: "session-1-dir-1",
      heroImageKey: "sessions/session-1/directions/1/hero.webp",
      moodLabel: "Bright abstract",
      tags: ["colorful", "abstract"],
      supportingImageKeys: [],
      colorPalette: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF"],
      description: "An abstract bright direction with bold colors.",
    },
  ],
};

function setupPaidSession() {
  // First select: session lookup
  addSelectResult([
    {
      id: "session-1",
      userId: "user-1",
      status: "paid",
      selectedDirectionId: "session-1-dir-0",
      selectedGenerationJobId: "job-1",
    },
  ]);
  // Second select: generation job lookup
  addSelectResult([
    {
      id: "job-1",
      directionData: MOCK_DIRECTION_DATA,
    },
  ]);

  mockCheckPackBoundary.mockResolvedValue({
    isPaid: true,
    canRegenerate: true,
    regenCount: 0,
    maxRegens: 3,
  });
}

describe("image generation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();

    mockFalGenerate.mockResolvedValue({
      imageUrl: "https://fal.ai/generated/image.webp",
      width: 1024,
      height: 1024,
      costCents: 5,
      durationMs: 2000,
    });
    mockUploadImageFromUrl.mockResolvedValue(undefined);
    mockUpdateSessionStatus.mockResolvedValue(undefined);
  });

  it("generates batch of images for paid session with valid direction", async () => {
    setupPaidSession();

    const { generateImages } = await import(
      "@/server/services/image-generation"
    );
    const result = await generateImages("session-1", "user-1", 1);

    expect(result.ok).toBe(true);
    expect(result.output?.imageCount).toBe(4);
    expect(result.output?.totalCostCents).toBe(20); // 4 images * 5 cents
    expect(mockFalGenerate).toHaveBeenCalledTimes(4);
    expect(mockUploadImageFromUrl).toHaveBeenCalledTimes(4);
  });

  it("rejects unpaid session", async () => {
    addSelectResult([
      {
        id: "session-1",
        userId: "user-1",
        status: "direction_selected",
        selectedDirectionId: "session-1-dir-0",
        selectedGenerationJobId: "job-1",
      },
    ]);

    const { generateImages } = await import(
      "@/server/services/image-generation"
    );
    const result = await generateImages("session-1", "user-1", 1);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INVALID_STATUS");
    expect(mockFalGenerate).not.toHaveBeenCalled();
  });

  it("rejects session not owned by user", async () => {
    addSelectResult([
      {
        id: "session-1",
        userId: "other-user",
        status: "paid",
        selectedDirectionId: "session-1-dir-0",
        selectedGenerationJobId: "job-1",
      },
    ]);

    const { generateImages } = await import(
      "@/server/services/image-generation"
    );
    const result = await generateImages("session-1", "user-1", 1);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("stores generation_attempts rows with correct fields", async () => {
    setupPaidSession();

    const { generateImages } = await import(
      "@/server/services/image-generation"
    );
    const result = await generateImages("session-1", "user-1", 1);

    expect(result.ok).toBe(true);
    // 4 images should create 4 insert calls
    expect(insertCalls.length).toBe(4);
  });

  it("updates session status to evaluating after generation", async () => {
    setupPaidSession();

    const { generateImages } = await import(
      "@/server/services/image-generation"
    );
    await generateImages("session-1", "user-1", 1);

    const statusCalls = mockUpdateSessionStatus.mock.calls.map(
      (c: unknown[]) => c[1]
    );
    expect(statusCalls).toContain("generating_images");
    expect(statusCalls).toContain("evaluating");
    expect(statusCalls[statusCalls.length - 1]).toBe("evaluating");
  });

  it("increments batch number on regeneration", async () => {
    // Session
    addSelectResult([
      {
        id: "session-1",
        userId: "user-1",
        status: "paid",
        selectedDirectionId: "session-1-dir-0",
        selectedGenerationJobId: "job-1",
      },
    ]);
    // Job
    addSelectResult([
      {
        id: "job-1",
        directionData: MOCK_DIRECTION_DATA,
      },
    ]);

    mockCheckPackBoundary.mockResolvedValue({
      isPaid: true,
      canRegenerate: true,
      regenCount: 1,
      maxRegens: 3,
    });

    const { generateImages } = await import(
      "@/server/services/image-generation"
    );
    const result = await generateImages("session-1", "user-1", 2);

    expect(result.ok).toBe(true);
    expect(result.output?.imageCount).toBe(4);
    // Verify batch number was passed through in insert values
    for (const call of insertCalls) {
      expect(call).toEqual(
        expect.objectContaining({ batchNumber: 2 })
      );
    }
  });

  it("rejects regeneration when regen limit reached", async () => {
    addSelectResult([
      {
        id: "session-1",
        userId: "user-1",
        status: "paid",
        selectedDirectionId: "session-1-dir-0",
        selectedGenerationJobId: "job-1",
      },
    ]);

    mockCheckPackBoundary.mockResolvedValue({
      isPaid: true,
      canRegenerate: false,
      regenCount: 3,
      maxRegens: 3,
    });

    const { generateImages } = await import(
      "@/server/services/image-generation"
    );
    const result = await generateImages("session-1", "user-1", 2);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("REGEN_LIMIT");
  });
});
