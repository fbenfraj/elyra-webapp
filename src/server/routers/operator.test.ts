import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/server/services/metrics", () => ({
  getHitRate: vi.fn().mockResolvedValue(85),
  getGenerationSuccessRate: vi
    .fn()
    .mockResolvedValue({ firstAttempt: 60, overall: 80 }),
  getAverageCostPerDeliverable: vi.fn().mockResolvedValue(42),
  getAverageLatency: vi.fn().mockResolvedValue(15000),
  getEvalScoreDistribution: vi.fn().mockResolvedValue({
    "0-0.3": 5,
    "0.3-0.5": 10,
    "0.5-0.7": 20,
    "0.7-0.85": 30,
    "0.85-1.0": 15,
  }),
  getSessionsWithCosts: vi.fn().mockResolvedValue([]),
  getSessionCostBreakdown: vi.fn().mockResolvedValue({
    sessionId: "s-1",
    totalCostCents: 25,
    attempts: [],
  }),
}));

vi.mock("@/server/services/session-review", () => ({
  getProblematicSessions: vi.fn().mockResolvedValue([]),
  getSessionDetail: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/services/provider-health", () => ({
  getProviderStatuses: vi.fn().mockResolvedValue([]),
  getProviderMetrics: vi.fn().mockResolvedValue({ provider: "fal", totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgDurationMs: 0, failureRate: 0, lastSuccess: null, lastFailure: null }),
}));

// Mock the trpc init to provide testable procedures
const mockUser = { id: "operator-user-1", email: "op@test.com" };

vi.mock("@/server/trpc/init", () => {
  const { initTRPC } = require("@trpc/server");
  const t = initTRPC.context<{ user: typeof mockUser | null }>().create();

  const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new (require("@trpc/server").TRPCError)({ code: "UNAUTHORIZED" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

  return {
    createTRPCRouter: t.router,
    authedProcedure,
    publicProcedure: t.procedure,
  };
});

describe("operator router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("access control", () => {
    it("rejects non-operator users with FORBIDDEN", async () => {
      // Set env to a different user
      vi.stubEnv("OPERATOR_USER_IDS", "some-other-user");

      // Re-import to pick up env change
      vi.resetModules();
      vi.mock("server-only", () => ({}));
      vi.mock("@/server/services/metrics", () => ({
        getHitRate: vi.fn().mockResolvedValue(85),
        getGenerationSuccessRate: vi
          .fn()
          .mockResolvedValue({ firstAttempt: 60, overall: 80 }),
        getAverageCostPerDeliverable: vi.fn().mockResolvedValue(42),
        getAverageLatency: vi.fn().mockResolvedValue(15000),
        getEvalScoreDistribution: vi.fn().mockResolvedValue({}),
        getSessionsWithCosts: vi.fn().mockResolvedValue([]),
        getSessionCostBreakdown: vi.fn().mockResolvedValue({
          sessionId: "s-1",
          totalCostCents: 0,
          attempts: [],
        }),
      }));
      vi.mock("@/server/services/session-review", () => ({
        getProblematicSessions: vi.fn().mockResolvedValue([]),
        getSessionDetail: vi.fn().mockResolvedValue(null),
      }));
      vi.mock("@/server/services/provider-health", () => ({
        getProviderStatuses: vi.fn().mockResolvedValue([]),
        getProviderMetrics: vi.fn().mockResolvedValue({ provider: "fal", totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgDurationMs: 0, failureRate: 0, lastSuccess: null, lastFailure: null }),
      }));

      const { initTRPC, TRPCError } = await import("@trpc/server");
      const t = initTRPC
        .context<{ user: { id: string; email: string } | null }>()
        .create();

      vi.doMock("@/server/trpc/init", () => {
        const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
          if (!ctx.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
          }
          return next({ ctx: { ...ctx, user: ctx.user } });
        });
        return {
          createTRPCRouter: t.router,
          authedProcedure,
          publicProcedure: t.procedure,
        };
      });

      const { operatorRouter } = await import("./operator");
      const caller = t.createCallerFactory(operatorRouter)({
        user: { id: "not-an-operator", email: "user@test.com" },
      });

      await expect(caller.getPipelineMetrics()).rejects.toThrow(
        "Operator access required"
      );
    });

    it("allows operator users", async () => {
      const operatorId = "operator-user-123";
      vi.stubEnv("OPERATOR_USER_IDS", operatorId);

      vi.resetModules();
      vi.mock("server-only", () => ({}));
      vi.mock("@/server/services/metrics", () => ({
        getHitRate: vi.fn().mockResolvedValue(85),
        getGenerationSuccessRate: vi
          .fn()
          .mockResolvedValue({ firstAttempt: 60, overall: 80 }),
        getAverageCostPerDeliverable: vi.fn().mockResolvedValue(42),
        getAverageLatency: vi.fn().mockResolvedValue(15000),
        getEvalScoreDistribution: vi.fn().mockResolvedValue({
          "0-0.3": 5,
        }),
        getSessionsWithCosts: vi.fn().mockResolvedValue([]),
        getSessionCostBreakdown: vi.fn().mockResolvedValue({
          sessionId: "s-1",
          totalCostCents: 0,
          attempts: [],
        }),
      }));
      vi.mock("@/server/services/session-review", () => ({
        getProblematicSessions: vi.fn().mockResolvedValue([]),
        getSessionDetail: vi.fn().mockResolvedValue(null),
      }));
      vi.mock("@/server/services/provider-health", () => ({
        getProviderStatuses: vi.fn().mockResolvedValue([]),
        getProviderMetrics: vi.fn().mockResolvedValue({ provider: "fal", totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgDurationMs: 0, failureRate: 0, lastSuccess: null, lastFailure: null }),
      }));

      const { initTRPC, TRPCError } = await import("@trpc/server");
      const t = initTRPC
        .context<{ user: { id: string; email: string } | null }>()
        .create();

      vi.doMock("@/server/trpc/init", () => {
        const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
          if (!ctx.user) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
          }
          return next({ ctx: { ...ctx, user: ctx.user } });
        });
        return {
          createTRPCRouter: t.router,
          authedProcedure,
          publicProcedure: t.procedure,
        };
      });

      const { operatorRouter } = await import("./operator");
      const caller = t.createCallerFactory(operatorRouter)({
        user: { id: operatorId, email: "op@test.com" },
      });

      const result = await caller.getPipelineMetrics();
      expect(result.hitRate).toBe(85);
      expect(result.successRate).toEqual({ firstAttempt: 60, overall: 80 });
      expect(result.avgCost).toBe(42);
    });
  });
});
