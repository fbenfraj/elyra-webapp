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
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: "attempt-1" }]),
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
    selected: "selected",
  },
}));

vi.mock("@/server/providers/fal", () => ({
  falAdapter: { generate: vi.fn() },
}));

vi.mock("@/server/providers/openai", () => ({
  refinePromptWithFeedback: vi.fn(),
}));

vi.mock("@/server/services/storage", () => ({
  uploadImageFromUrl: vi.fn(),
}));

const mockUpdateSessionStatus = vi.fn();
vi.mock("@/server/services/session", () => ({
  updateSessionStatus: (...args: unknown[]) => mockUpdateSessionStatus(...args),
}));

vi.mock("@/server/services/payment", () => ({
  checkPackBoundary: vi.fn().mockResolvedValue({ isPaid: true, canRegenerate: true }),
}));

vi.mock("@/config/providers", () => ({
  FAL_FINAL_MODEL: "fal-ai/flux-pro/v2",
  FAL_FINAL_COST_PER_IMAGE_CENTS: 5,
  FINAL_IMAGE_COUNT: 4,
  FINAL_IMAGE_WIDTH: 1024,
  FINAL_IMAGE_HEIGHT: 1024,
  FAL_PREVIEW_MODEL: "fal-ai/flux/schnell",
  FAL_COST_PER_IMAGE_CENTS: 0.3,
}));

describe("selectImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    mockUpdateSessionStatus.mockResolvedValue(undefined);
  });

  it("selects image correctly — deselects all then selects chosen", async () => {
    // Session lookup
    addSelectResult([{ id: "s1", userId: "user-1", status: "selecting" }]);
    // Attempt lookup
    addSelectResult([{ id: "attempt-1" }]);

    const { selectImage } = await import("@/server/services/image-generation");
    const result = await selectImage("s1", "user-1", "attempt-1");

    expect(result.ok).toBe(true);
    // Two update calls: deselect all, then select chosen
    expect(updateCalls.length).toBe(2);
    expect(updateCalls[0]?.set).toEqual({ selected: false });
    expect(updateCalls[1]?.set).toEqual({ selected: true });
  });

  it("rejects when session not found", async () => {
    addSelectResult([]);

    const { selectImage } = await import("@/server/services/image-generation");
    const result = await selectImage("s1", "user-1", "attempt-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("rejects when session is not in selecting phase", async () => {
    addSelectResult([{ id: "s1", userId: "user-1", status: "paid" }]);

    const { selectImage } = await import("@/server/services/image-generation");
    const result = await selectImage("s1", "user-1", "attempt-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_STATUS");
    }
  });

  it("rejects when attempt not found", async () => {
    addSelectResult([{ id: "s1", userId: "user-1", status: "selecting" }]);
    addSelectResult([]); // No attempt found

    const { selectImage } = await import("@/server/services/image-generation");
    const result = await selectImage("s1", "user-1", "nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

describe("confirmSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    mockUpdateSessionStatus.mockResolvedValue(undefined);
  });

  it("updates session status to packaging", async () => {
    // Session lookup
    addSelectResult([{ id: "s1", userId: "user-1", status: "selecting" }]);
    // Selected attempt lookup
    addSelectResult([{ id: "attempt-1" }]);

    const { confirmSelection } = await import("@/server/services/image-generation");
    const result = await confirmSelection("s1", "user-1");

    expect(result.ok).toBe(true);
    expect(mockUpdateSessionStatus).toHaveBeenCalledWith("s1", "packaging");
  });

  it("rejects when no image is selected", async () => {
    addSelectResult([{ id: "s1", userId: "user-1", status: "selecting" }]);
    addSelectResult([]); // No selected attempt

    const { confirmSelection } = await import("@/server/services/image-generation");
    const result = await confirmSelection("s1", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_SELECTION");
    }
  });

  it("rejects when session is not in selecting phase", async () => {
    addSelectResult([{ id: "s1", userId: "user-1", status: "paid" }]);

    const { confirmSelection } = await import("@/server/services/image-generation");
    const result = await confirmSelection("s1", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_STATUS");
    }
  });
});
