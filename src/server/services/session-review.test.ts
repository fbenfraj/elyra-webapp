import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock DB
const mockExecute = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              const result = mockWhere(...wArgs);
              // If mockWhere returns a value, use it as the resolved value
              const resolved = result !== undefined ? result : [];
              const promise = Promise.resolve(resolved);
              // Make the promise also chainable with .orderBy()
              return Object.assign(promise, {
                orderBy: (...oArgs: unknown[]) => {
                  mockOrderBy(...oArgs);
                  const orderResult = mockOrderBy.mock.results[mockOrderBy.mock.results.length - 1];
                  return Promise.resolve(orderResult?.type === "return" && orderResult.value !== undefined ? orderResult.value : resolved);
                },
              });
            },
          };
        },
      };
    },
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: { id: "id", briefText: "brief_text", status: "status", refinementCount: "refinement_count", refinementHistory: "refinement_history", createdAt: "created_at", sessionId: "session_id" },
}));

vi.mock("@/server/db/schema/generation-attempts", () => ({
  generationAttempts: { id: "id", sessionId: "session_id", evaluationScore: "evaluation_score", batchNumber: "batch_number" },
}));

vi.mock("@/server/db/schema/visual-specs", () => ({
  visualSpecs: { id: "id", sessionId: "session_id", specData: "spec_data" },
}));

vi.mock("@/config/evaluation", () => ({
  MIN_PASS_SCORE: 0.7,
}));

describe("session-review service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProblematicSessions", () => {
    it("queries sessions with zero hit rate filter", async () => {
      mockExecute.mockResolvedValue([]);

      const { getProblematicSessions } = await import("@/server/services/session-review");
      const result = await getProblematicSessions({ zeroHitRate: true });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it("queries sessions with multiple filters", async () => {
      const mockRows = [
        { id: "s1", brief_text: "test brief", status: "complete", refinement_count: 4, total_cost_cents: 150, attempt_count: 5, avg_eval_score: 0.3 },
      ];
      mockExecute.mockResolvedValue(mockRows);

      const { getProblematicSessions } = await import("@/server/services/session-review");
      const result = await getProblematicSessions({
        lowScores: true,
        vagueBriefs: true,
      });

      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRows);
    });

    it("applies date range filter when provided", async () => {
      mockExecute.mockResolvedValue([]);

      const { getProblematicSessions } = await import("@/server/services/session-review");
      const from = new Date("2025-01-01");
      const to = new Date("2025-01-31");
      await getProblematicSessions({ highRetries: true }, { from, to });

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when no filters applied", async () => {
      mockExecute.mockResolvedValue([]);

      const { getProblematicSessions } = await import("@/server/services/session-review");
      const result = await getProblematicSessions({});

      expect(result).toEqual([]);
    });
  });

  describe("getSessionDetail", () => {
    it("returns null for non-existent session", async () => {
      mockWhere.mockReturnValue([]);
      mockOrderBy.mockReturnValue([]);

      const { getSessionDetail } = await import("@/server/services/session-review");
      const result = await getSessionDetail("nonexistent");

      expect(result).toBeNull();
    });

    it("returns complete session detail with attempts", async () => {
      const mockSession = {
        id: "s1",
        briefText: "test brief",
        status: "complete",
        refinementCount: 2,
        refinementHistory: null,
        createdAt: new Date(),
      };
      const mockAttempts = [
        {
          id: "a1",
          promptUsed: "prompt1",
          evaluationScore: 0.8,
          evaluationFeedback: { scores: {} },
          selected: true,
          costCents: 10,
          model: "gpt-4",
          provider: "openai",
          batchNumber: 1,
        },
      ];

      let callCount = 0;
      mockWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return [mockSession];
        if (callCount === 2) return [{ specData: { mood: "dark" } }];
        return mockAttempts;
      });
      mockOrderBy.mockReturnValue(mockAttempts);

      const { getSessionDetail } = await import("@/server/services/session-review");
      const result = await getSessionDetail("s1");

      expect(result).not.toBeNull();
      expect(result?.session.id).toBe("s1");
      expect(result?.attempts).toHaveLength(1);
      expect(result?.totalCostCents).toBe(10);
    });
  });
});
