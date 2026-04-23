import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock DB
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInnerJoin = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => mockWhere(...wArgs),
            innerJoin: (...jArgs: unknown[]) => {
              mockInnerJoin(...jArgs);
              return {
                where: (...wArgs: unknown[]) => mockWhere(...wArgs),
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock("@/server/db/schema/generation-attempts", () => ({
  generationAttempts: {
    sessionId: "session_id",
    costCents: "cost_cents",
    createdAt: "created_at",
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
  },
}));

vi.mock("@/config/limits", () => ({
  MAX_SESSION_COST_CENTS: 200,
  MAX_USER_DAILY_COST_CENTS: 500,
}));

describe("budget service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSessionCost", () => {
    it("returns summed cost for a session", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 150 }]);

      const { getSessionCost } = await import("@/server/services/budget");
      const cost = await getSessionCost("session-1");

      expect(cost).toBe(150);
    });

    it("returns 0 when no attempts exist", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 0 }]);

      const { getSessionCost } = await import("@/server/services/budget");
      const cost = await getSessionCost("session-empty");

      expect(cost).toBe(0);
    });
  });

  describe("checkSessionBudget", () => {
    it("allows generation when under limit", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 100 }]);

      const { checkSessionBudget } = await import("@/server/services/budget");
      const result = await checkSessionBudget("session-1");

      expect(result.allowed).toBe(true);
      expect(result.currentCostCents).toBe(100);
      expect(result.limitCents).toBe(200);
    });

    it("blocks generation when at limit", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 200 }]);

      const { checkSessionBudget } = await import("@/server/services/budget");
      const result = await checkSessionBudget("session-1");

      expect(result.allowed).toBe(false);
      expect(result.currentCostCents).toBe(200);
    });

    it("blocks generation when over limit", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 250 }]);

      const { checkSessionBudget } = await import("@/server/services/budget");
      const result = await checkSessionBudget("session-1");

      expect(result.allowed).toBe(false);
      expect(result.currentCostCents).toBe(250);
    });

    it("fails open when DB errors", async () => {
      mockWhere.mockRejectedValueOnce(new Error("DB connection failed"));

      const { checkSessionBudget } = await import("@/server/services/budget");
      const result = await checkSessionBudget("session-1");

      expect(result.allowed).toBe(true);
      expect(result.currentCostCents).toBe(0);
    });
  });

  describe("getUserDailyCost", () => {
    it("returns summed daily cost for a user", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 350 }]);

      const { getUserDailyCost } = await import("@/server/services/budget");
      const cost = await getUserDailyCost("user-1");

      expect(cost).toBe(350);
    });

    it("returns 0 when no attempts today", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 0 }]);

      const { getUserDailyCost } = await import("@/server/services/budget");
      const cost = await getUserDailyCost("user-1");

      expect(cost).toBe(0);
    });
  });

  describe("checkUserBudget", () => {
    it("allows generation when under daily limit", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 300 }]);

      const { checkUserBudget } = await import("@/server/services/budget");
      const result = await checkUserBudget("user-1");

      expect(result.allowed).toBe(true);
      expect(result.currentCostCents).toBe(300);
      expect(result.limitCents).toBe(500);
    });

    it("blocks generation when at daily limit", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 500 }]);

      const { checkUserBudget } = await import("@/server/services/budget");
      const result = await checkUserBudget("user-1");

      expect(result.allowed).toBe(false);
      expect(result.currentCostCents).toBe(500);
    });

    it("blocks generation when over daily limit", async () => {
      mockWhere.mockResolvedValueOnce([{ total: 600 }]);

      const { checkUserBudget } = await import("@/server/services/budget");
      const result = await checkUserBudget("user-1");

      expect(result.allowed).toBe(false);
      expect(result.currentCostCents).toBe(600);
    });

    it("fails open when DB errors", async () => {
      mockWhere.mockRejectedValueOnce(new Error("DB connection failed"));

      const { checkUserBudget } = await import("@/server/services/budget");
      const result = await checkUserBudget("user-1");

      expect(result.allowed).toBe(true);
      expect(result.currentCostCents).toBe(0);
    });
  });
});
