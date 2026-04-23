import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const insertValuesMock = vi.fn().mockResolvedValue(undefined);
const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

const limitMock = vi.fn();
const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
const fromMock = vi.fn().mockReturnValue({ where: whereMock });
const selectMock = vi.fn().mockReturnValue({ from: fromMock });

vi.mock("@/server/db", () => ({
  db: {
    insert: (...args: unknown[]) => insertMock(...args),
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

vi.mock("@/server/db/schema/feedback", () => ({
  feedback: {
    id: "id",
    userId: "user_id",
    sessionId: "session_id",
    generationAttemptId: "generation_attempt_id",
    action: "action",
    createdAt: "created_at",
  },
}));

describe("feedback service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toggleLike", () => {
    it("returns liked: true when no prior feedback exists", async () => {
      limitMock.mockResolvedValue([]);

      const { toggleLike } = await import("./feedback");
      const result = await toggleLike("user-1", "session-1", "attempt-1");

      expect(result).toEqual({ liked: true });
      expect(insertMock).toHaveBeenCalled();
      expect(insertValuesMock).toHaveBeenCalledWith({
        userId: "user-1",
        sessionId: "session-1",
        generationAttemptId: "attempt-1",
        action: "like",
      });
    });

    it("returns liked: false when latest action is like", async () => {
      limitMock.mockResolvedValue([{ action: "like" }]);

      const { toggleLike } = await import("./feedback");
      const result = await toggleLike("user-1", "session-1", "attempt-1");

      expect(result).toEqual({ liked: false });
      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: "unlike" })
      );
    });

    it("returns liked: true when latest action is unlike", async () => {
      limitMock.mockResolvedValue([{ action: "unlike" }]);

      const { toggleLike } = await import("./feedback");
      const result = await toggleLike("user-1", "session-1", "attempt-1");

      expect(result).toEqual({ liked: true });
      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: "like" })
      );
    });
  });

  describe("getLikedAttemptIds", () => {
    it("returns only attempt ids where latest action is like", async () => {
      // orderBy(desc(createdAt)) — first row per attempt is latest
      whereMock.mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([
          {
            generationAttemptId: "attempt-1",
            action: "like",
            createdAt: new Date("2026-01-02"),
          },
          {
            generationAttemptId: "attempt-1",
            action: "unlike",
            createdAt: new Date("2026-01-01"),
          },
          {
            generationAttemptId: "attempt-2",
            action: "unlike",
            createdAt: new Date("2026-01-02"),
          },
          {
            generationAttemptId: "attempt-2",
            action: "like",
            createdAt: new Date("2026-01-01"),
          },
          {
            generationAttemptId: "attempt-3",
            action: "like",
            createdAt: new Date("2026-01-01"),
          },
        ]),
      });

      const { getLikedAttemptIds } = await import("./feedback");
      const result = await getLikedAttemptIds("user-1", "session-1");

      expect(result).toEqual(["attempt-1", "attempt-3"]);
    });

    it("returns empty array when no feedback exists", async () => {
      whereMock.mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      });

      const { getLikedAttemptIds } = await import("./feedback");
      const result = await getLikedAttemptIds("user-1", "session-1");

      expect(result).toEqual([]);
    });
  });
});
