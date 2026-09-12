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
    selectedGenerationJobId: "selected_generation_job_id",
    refinementCount: "refinement_count",
    refinementHistory: "refinement_history",
    regenCount: "regen_count",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

describe("session service", () => {
  it("createSession inserts and returns session id", async () => {
    const { createSession } = await import("./session");
    const result = await createSession("user-123", "dark cinematic trap", "album_cover", null);
    expect(result).toEqual({ id: "test-session-id" });
  });

  describe("editBrief", () => {
    it("returns INVALID_STATUS when editing from a disallowed status", async () => {
      // Override the db mock so select returns a session with status "interpreting"
      const dbModule = await import("@/server/db");
      const mockDb = dbModule.db as unknown as ReturnType<typeof vi.fn> &
        Record<string, ReturnType<typeof vi.fn>>;

      const whereMock = vi.fn().mockResolvedValue([
        {
          id: "sess-1",
          userId: "user-1",
          status: "interpreting",
          briefText: "old brief",
          refinementCount: 0,
          refinementHistory: null,
        },
      ]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockDb.select = vi.fn().mockReturnValue({ from: fromMock });

      const { editBrief } = await import("./session");
      const result = await editBrief("sess-1", "user-1", "new brief");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_STATUS");
        expect(result.error.message).toContain("interpreting");
      }
    });

    it("succeeds when editing from 'selecting' status", async () => {
      const dbModule = await import("@/server/db");
      const mockDb = dbModule.db as unknown as ReturnType<typeof vi.fn> &
        Record<string, ReturnType<typeof vi.fn>>;

      const selectWhereMock = vi.fn().mockResolvedValue([
        {
          id: "sess-2",
          userId: "user-1",
          status: "selecting",
          briefText: "old brief",
          refinementCount: 0,
          refinementHistory: null,
        },
      ]);
      const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
      mockDb.select = vi.fn().mockReturnValue({ from: selectFromMock });

      const updateReturningMock = vi.fn().mockResolvedValue([{ id: "sess-2" }]);
      const updateWhereMock = vi.fn().mockReturnValue({ returning: updateReturningMock });
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

      const { editBrief } = await import("./session");
      const result = await editBrief("sess-2", "user-1", "updated brief");

      expect(result.ok).toBe(true);
    });
  });

  describe("changeDirectionPostPayment", () => {
    it("returns INVALID_STATUS when changing direction from a pre-payment status", async () => {
      const dbModule = await import("@/server/db");
      const mockDb = dbModule.db as unknown as ReturnType<typeof vi.fn> &
        Record<string, ReturnType<typeof vi.fn>>;

      const whereMock = vi.fn().mockResolvedValue([
        {
          id: "sess-3",
          userId: "user-1",
          status: "selecting",
        },
      ]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      mockDb.select = vi.fn().mockReturnValue({ from: fromMock });

      const { changeDirectionPostPayment } = await import("./session");
      const result = await changeDirectionPostPayment("sess-3", "user-1", "dir-1", "gen-job-1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_STATUS");
        expect(result.error.message).toContain("selecting");
      }
    });

    it("succeeds when changing direction from 'paid' status", async () => {
      const dbModule = await import("@/server/db");
      const mockDb = dbModule.db as unknown as ReturnType<typeof vi.fn> &
        Record<string, ReturnType<typeof vi.fn>>;

      const selectWhereMock = vi.fn().mockResolvedValue([
        {
          id: "sess-4",
          userId: "user-1",
          status: "paid",
        },
      ]);
      const selectFromMock = vi.fn().mockReturnValue({ where: selectWhereMock });
      mockDb.select = vi.fn().mockReturnValue({ from: selectFromMock });

      const updateReturningMock = vi.fn().mockResolvedValue([{ id: "sess-4" }]);
      const updateWhereMock = vi.fn().mockReturnValue({ returning: updateReturningMock });
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      mockDb.update = vi.fn().mockReturnValue({ set: updateSetMock });

      const { changeDirectionPostPayment } = await import("./session");
      const result = await changeDirectionPostPayment("sess-4", "user-1", "dir-2", "gen-job-2");

      expect(result.ok).toBe(true);
    });
  });
});
