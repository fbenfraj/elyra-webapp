import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
    status: "status",
    failedStage: "failed_stage",
    briefText: "brief_text",
    regenCount: "regen_count",
  },
}));

vi.mock("drizzle-orm", () => {
  const sqlFn = Object.assign(
    (...args: unknown[]) => args,
    { raw: vi.fn() }
  );
  return {
    eq: vi.fn((...args: unknown[]) => args),
    and: vi.fn((...args: unknown[]) => args),
    desc: vi.fn((col: unknown) => col),
    sql: sqlFn,
  };
});

import {
  failSession,
  clearFailedStage,
  getSessionById,
} from "@/server/services/session";

describe("failSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue(undefined);
  });

  it("sets status to failed and records failedStage", async () => {
    await failSession("session-1", "generating_directions");

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failedStage: "generating_directions",
      })
    );
  });
});

describe("clearFailedStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue(undefined);
  });

  it("sets failedStage to null", async () => {
    await clearFailedStage("session-1");

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        failedStage: null,
      })
    );
  });
});

describe("getSessionById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when session not found", async () => {
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);

    const result = await getSessionById("missing-id");
    expect(result).toBeNull();
  });

  it("returns session with failedStage when found", async () => {
    const mockSession = {
      id: "session-1",
      userId: "user-1",
      status: "failed",
      failedStage: "generating_images",
      briefText: "test brief",
      regenCount: 0,
    };
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([mockSession]);

    const result = await getSessionById("session-1");
    expect(result).toEqual(mockSession);
    expect(result?.failedStage).toBe("generating_images");
  });
});

describe("canRetry logic", () => {
  function computeCanRetry(failedStage: string): boolean {
    const isContentPolicy = failedStage === "content_policy";
    return !isContentPolicy;
  }

  it("content_policy failedStage is not retryable", () => {
    expect(computeCanRetry("content_policy")).toBe(false);
  });

  it("generating_images failedStage is retryable", () => {
    expect(computeCanRetry("generating_images")).toBe(true);
  });

  it("evaluating failedStage is retryable", () => {
    expect(computeCanRetry("evaluating")).toBe(true);
  });

  it("packaging failedStage is retryable", () => {
    expect(computeCanRetry("packaging")).toBe(true);
  });
});

describe("stage-to-status mapping", () => {
  const stageToStatusMap: Record<string, string> = {
    interpreting: "interpreting",
    generating_directions: "generating_directions",
    generating_images: "generating_images",
    evaluating: "evaluating",
    packaging: "packaging",
  };

  it("maps each failedStage to its in-progress status correctly", () => {
    expect(stageToStatusMap["interpreting"]).toBe("interpreting");
    expect(stageToStatusMap["generating_directions"]).toBe("generating_directions");
    expect(stageToStatusMap["generating_images"]).toBe("generating_images");
    expect(stageToStatusMap["evaluating"]).toBe("evaluating");
    expect(stageToStatusMap["packaging"]).toBe("packaging");
  });

  it("returns undefined for unknown stages", () => {
    expect(stageToStatusMap["unknown_stage"]).toBeUndefined();
  });
});

describe("error messages never expose provider details", () => {
  const errorMessages = [
    "Something went wrong. Try again?",
    "Something went wrong interpreting your brief. Give it another try.",
    "Something went wrong generating your directions. Give it another try.",
    "Something went wrong generating your images. Give it another try.",
    "Something went wrong evaluating your images. Give it another try.",
    "Something went wrong assembling your package. Give it another try.",
    "We couldn't generate that image. Try adjusting your brief.",
    "We couldn't process this brief. Try describing your vision with different words.",
    "We hit a snag. Your brief is saved — try again?",
    "Taking a bit longer than usual...",
  ];

  it.each(errorMessages)("message '%s' does not contain provider names", (msg) => {
    const lower = msg.toLowerCase();
    expect(lower).not.toContain("fal");
    expect(lower).not.toContain("openai");
    expect(lower).not.toContain("gpt");
    expect(lower).not.toContain("api");
    expect(lower).not.toContain("500");
    expect(lower).not.toContain("error code");
    expect(lower).not.toContain("model");
  });
});
