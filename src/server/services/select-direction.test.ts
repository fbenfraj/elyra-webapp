import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const whereMock = vi.fn();
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
    selectedDirectionIndex: "selected_direction_index",
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
    const result = await selectDirection("nonexistent", "user-1", 0);

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
    const result = await selectDirection("s1", "user-1", 0);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_STATUS");
    }
  });

  it("updates session when status is complete", async () => {
    selectWhereMock.mockResolvedValueOnce([{ id: "s1", status: "complete" }]);
    whereMock.mockResolvedValueOnce(undefined);

    const { selectDirection } = await import("./session");
    const result = await selectDirection("s1", "user-1", 1);

    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedDirectionIndex: 1,
        status: "direction_selected",
      })
    );
  });
});
