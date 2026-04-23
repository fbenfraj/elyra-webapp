import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const executeMock = vi.fn();
const selectMock = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    execute: (...args: unknown[]) => executeMock(...args),
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

vi.mock("@/server/db/schema/generation-attempts", () => ({
  generationAttempts: {
    id: "id",
    sessionId: "session_id",
    costCents: "cost_cents",
    model: "model",
    provider: "provider",
    evaluationScore: "evaluation_score",
    selected: "selected",
    batchNumber: "batch_number",
    createdAt: "created_at",
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    status: "status",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

vi.mock("@/server/db/schema/generation-jobs", () => ({
  generationJobs: {
    id: "id",
    sessionId: "session_id",
  },
}));

vi.mock("@/config/evaluation", () => ({
  MIN_PASS_SCORE: 0.7,
}));

describe("metrics service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getHitRate", () => {
    it("returns hit rate from query result", async () => {
      executeMock.mockResolvedValueOnce([{ hit_rate: 85.5 }]);

      const { getHitRate } = await import("./metrics");
      const result = await getHitRate();
      expect(result).toBe(85.5);
      expect(executeMock).toHaveBeenCalledOnce();
    });

    it("returns 0 when no rows", async () => {
      executeMock.mockResolvedValueOnce([]);

      const { getHitRate } = await import("./metrics");
      const result = await getHitRate();
      expect(result).toBe(0);
    });
  });

  describe("getGenerationSuccessRate", () => {
    it("returns first attempt and overall rates", async () => {
      executeMock.mockResolvedValueOnce([
        { first_attempt_rate: 60.0, overall_rate: 80.0 },
      ]);

      const { getGenerationSuccessRate } = await import("./metrics");
      const result = await getGenerationSuccessRate();
      expect(result).toEqual({ firstAttempt: 60, overall: 80 });
    });
  });

  describe("getAverageCostPerDeliverable", () => {
    it("returns average cost in cents", async () => {
      executeMock.mockResolvedValueOnce([{ avg_cost: 42.5 }]);

      const { getAverageCostPerDeliverable } = await import("./metrics");
      const result = await getAverageCostPerDeliverable();
      expect(result).toBe(42.5);
    });
  });

  describe("getAverageLatency", () => {
    it("returns average latency in ms", async () => {
      executeMock.mockResolvedValueOnce([{ avg_latency_ms: 15000 }]);

      const { getAverageLatency } = await import("./metrics");
      const result = await getAverageLatency();
      expect(result).toBe(15000);
    });
  });

  describe("getEvalScoreDistribution", () => {
    it("returns distribution buckets", async () => {
      executeMock.mockResolvedValueOnce([
        {
          "0-0.3": 5,
          "0.3-0.5": 10,
          "0.5-0.7": 20,
          "0.7-0.85": 30,
          "0.85-1.0": 15,
        },
      ]);

      const { getEvalScoreDistribution } = await import("./metrics");
      const result = await getEvalScoreDistribution();
      expect(result).toEqual({
        "0-0.3": 5,
        "0.3-0.5": 10,
        "0.5-0.7": 20,
        "0.7-0.85": 30,
        "0.85-1.0": 15,
      });
    });
  });

  describe("getSessionCostBreakdown", () => {
    it("returns session cost details", async () => {
      const fromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { costCents: 10, model: "dall-e-3", provider: "openai" },
          { costCents: 15, model: "dall-e-3", provider: "openai" },
        ]),
      });
      selectMock.mockReturnValue({ from: fromMock });

      const { getSessionCostBreakdown } = await import("./metrics");
      const result = await getSessionCostBreakdown("session-1");
      expect(result.sessionId).toBe("session-1");
      expect(result.totalCostCents).toBe(25);
      expect(result.attempts).toHaveLength(2);
    });
  });

  describe("getSessionsWithCosts", () => {
    it("returns sessions with cost data", async () => {
      executeMock.mockResolvedValueOnce([
        {
          id: "s-1",
          brief_text: "test brief",
          status: "complete",
          total_cost_cents: 50,
          attempt_count: 4,
          avg_eval_score: 0.82,
        },
      ]);

      const { getSessionsWithCosts } = await import("./metrics");
      const result = await getSessionsWithCosts();
      expect(result).toHaveLength(1);
      expect(result[0].total_cost_cents).toBe(50);
    });
  });

  describe("date range filtering", () => {
    it("passes date range to hit rate query", async () => {
      executeMock.mockResolvedValueOnce([{ hit_rate: 90 }]);

      const { getHitRate } = await import("./metrics");
      const range = {
        from: new Date("2026-01-01"),
        to: new Date("2026-01-31"),
      };
      const result = await getHitRate(range);
      expect(result).toBe(90);
      expect(executeMock).toHaveBeenCalledOnce();
    });
  });
});
