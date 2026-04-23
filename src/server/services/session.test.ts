import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => {
  const returningMock = vi.fn().mockResolvedValue([{ id: "test-session-id" }]);
  const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });

  return {
    db: {
      insert: insertMock,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    },
  };
});

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

describe("session service", () => {
  it("createSession inserts and returns session id", async () => {
    const { createSession } = await import("./session");
    const result = await createSession("user-123", "dark cinematic trap");
    expect(result).toEqual({ id: "test-session-id" });
  });
});
