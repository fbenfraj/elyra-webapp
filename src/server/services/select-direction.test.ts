import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const returningMock = vi.fn().mockResolvedValue([{ id: "s1" }]);
const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
const setMock = vi.fn().mockReturnValue({ where: whereMock });
const updateMock = vi.fn().mockReturnValue({ set: setMock });

const selectWhereMock = vi.fn();
const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
const selectFieldsMock = vi.fn().mockReturnValue({ from: selectFromMock });

vi.mock("@/server/db", () => ({
  db: {
    select: selectFieldsMock,
    update: updateMock,
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
    briefText: "brief_text",
    status: "status",
    selectedDirectionId: "selected_direction_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

describe("selectDirection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when session not found", async () => {
    selectWhereMock.mockResolvedValueOnce([]);

    const { selectDirection } = await import("./session");
    const result = await selectDirection("nonexistent", "user-1", "dir-0");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns error when session status is not complete", async () => {
    selectWhereMock.mockResolvedValueOnce([
      { id: "s1", status: "generating_directions" },
    ]);

    const { selectDirection } = await import("./session");
    const result = await selectDirection("s1", "user-1", "dir-0");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_STATUS");
    }
  });

  it("updates session with direction ID when status is complete", async () => {
    selectWhereMock.mockResolvedValueOnce([{ id: "s1", status: "complete" }]);
    returningMock.mockResolvedValueOnce([{ id: "s1" }]);

    const { selectDirection } = await import("./session");
    const result = await selectDirection("s1", "user-1", "dir-1");

    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedDirectionId: "dir-1",
        status: "direction_selected",
      })
    );
  });

  it("stores direction ID not index", async () => {
    selectWhereMock.mockResolvedValueOnce([{ id: "s1", status: "complete" }]);
    returningMock.mockResolvedValueOnce([{ id: "s1" }]);

    const { selectDirection } = await import("./session");
    const result = await selectDirection("s1", "user-1", "dir-abc-123");

    expect(result.ok).toBe(true);
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedDirectionId: "dir-abc-123",
      })
    );
    // Ensure no index is stored
    const setArg = setMock.mock.calls[0]?.[0];
    expect(setArg).not.toHaveProperty("selectedDirectionIndex");
  });

  it("returns STALE_SESSION error when concurrent modification occurs", async () => {
    selectWhereMock.mockResolvedValueOnce([{ id: "s1", status: "selecting" }]);
    returningMock.mockResolvedValueOnce([]); // 0 rows — concurrent modification

    const { selectDirection } = await import("./session");
    const result = await selectDirection("s1", "user-1", "dir-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STALE_SESSION");
    }
  });
});
