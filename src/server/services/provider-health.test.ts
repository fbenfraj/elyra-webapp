import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/server/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock("@/server/services/circuit-breaker", () => ({
  getAllStates: vi.fn(),
}));

vi.mock("@/server/providers/fal", () => ({
  falAdapter: {
    getHealth: vi.fn(),
  },
}));

vi.mock("@/server/providers/openai", () => ({
  openaiEvaluationAdapter: {
    getHealth: vi.fn(),
  },
}));

vi.mock("@/server/providers/anthropic", () => ({
  anthropicEvaluationAdapter: {
    getHealth: vi.fn(),
  },
}));

import { getProviderStatuses, getProviderMetrics, getCircuitBreakerStates } from "./provider-health";
import { getAllStates } from "@/server/services/circuit-breaker";
import { falAdapter } from "@/server/providers/fal";
import { openaiEvaluationAdapter } from "@/server/providers/openai";
import { anthropicEvaluationAdapter } from "@/server/providers/anthropic";
import { db } from "@/server/db";

const mockGetAllStates = vi.mocked(getAllStates);
const mockFalHealth = vi.mocked(falAdapter.getHealth);
const mockOpenaiHealth = vi.mocked(openaiEvaluationAdapter.getHealth);
const mockAnthropicHealth = vi.mocked(anthropicEvaluationAdapter.getHealth);
const mockDbExecute = vi.mocked(db.execute);

describe("provider-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllStates.mockReturnValue({});
  });

  describe("getProviderStatuses", () => {
    it("returns health for all registered providers", async () => {
      const healthData = {
        status: "up" as const,
        lastChecked: new Date(),
        latencyMs: 100,
        errorCount: 0,
      };

      mockFalHealth.mockResolvedValue(healthData);
      mockOpenaiHealth.mockResolvedValue(healthData);
      mockAnthropicHealth.mockResolvedValue(healthData);

      const result = await getProviderStatuses();

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.provider).sort()).toEqual(["anthropic", "fal", "openai"]);
    });

    it("includes circuit breaker state for each provider", async () => {
      const healthData = {
        status: "up" as const,
        lastChecked: new Date(),
        latencyMs: 50,
        errorCount: 0,
      };

      mockFalHealth.mockResolvedValue(healthData);
      mockOpenaiHealth.mockResolvedValue(healthData);
      mockAnthropicHealth.mockResolvedValue(healthData);
      mockGetAllStates.mockReturnValue({
        fal: {
          state: "open" as const,
          failureCount: 5,
          lastFailureTime: Date.now(),
          lastSuccessTime: null,
          openedAt: Date.now(),
        },
      });

      const result = await getProviderStatuses();
      const falStatus = result.find((r) => r.provider === "fal");

      expect(falStatus?.circuitBreakerState.state).toBe("open");
      expect(falStatus?.circuitBreakerState.failureCount).toBe(5);
    });

    it("defaults circuit breaker to closed when no state exists", async () => {
      const healthData = {
        status: "up" as const,
        lastChecked: new Date(),
        latencyMs: 50,
        errorCount: 0,
      };

      mockFalHealth.mockResolvedValue(healthData);
      mockOpenaiHealth.mockResolvedValue(healthData);
      mockAnthropicHealth.mockResolvedValue(healthData);

      const result = await getProviderStatuses();
      const openaiStatus = result.find((r) => r.provider === "openai");

      expect(openaiStatus?.circuitBreakerState.state).toBe("closed");
      expect(openaiStatus?.circuitBreakerState.failureCount).toBe(0);
    });

    it("filters out providers whose getHealth rejects", async () => {
      const healthData = {
        status: "up" as const,
        lastChecked: new Date(),
        latencyMs: 50,
        errorCount: 0,
      };

      mockFalHealth.mockResolvedValue(healthData);
      mockOpenaiHealth.mockRejectedValue(new Error("connection refused"));
      mockAnthropicHealth.mockResolvedValue(healthData);

      const result = await getProviderStatuses();

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.provider).sort()).toEqual(["anthropic", "fal"]);
    });
  });

  describe("getProviderMetrics", () => {
    it("returns aggregated metrics for a provider", async () => {
      mockDbExecute.mockResolvedValue([
        {
          total_calls: "100",
          successful_calls: "90",
          failed_calls: "10",
          avg_duration_ms: "250.5",
          last_success: "2026-04-23T10:00:00Z",
          last_failure: "2026-04-23T09:30:00Z",
        },
      ] as never);

      const result = await getProviderMetrics("fal");

      expect(result.provider).toBe("fal");
      expect(result.totalCalls).toBe(100);
      expect(result.successfulCalls).toBe(90);
      expect(result.failedCalls).toBe(10);
      expect(result.avgDurationMs).toBeCloseTo(250.5);
      expect(result.failureRate).toBe(10);
      expect(result.lastSuccess).toBeInstanceOf(Date);
      expect(result.lastFailure).toBeInstanceOf(Date);
    });

    it("returns zeroes when no data exists", async () => {
      mockDbExecute.mockResolvedValue([
        {
          total_calls: "0",
          successful_calls: "0",
          failed_calls: "0",
          avg_duration_ms: null,
          last_success: null,
          last_failure: null,
        },
      ] as never);

      const result = await getProviderMetrics("openai");

      expect(result.totalCalls).toBe(0);
      expect(result.failureRate).toBe(0);
      expect(result.lastSuccess).toBeNull();
      expect(result.lastFailure).toBeNull();
    });

    it("handles empty result set", async () => {
      mockDbExecute.mockResolvedValue([] as never);

      const result = await getProviderMetrics("anthropic");

      expect(result.totalCalls).toBe(0);
      expect(result.failureRate).toBe(0);
    });
  });

  describe("getCircuitBreakerStates", () => {
    it("delegates to circuit-breaker service", () => {
      const states = {
        fal: { state: "closed" as const, failureCount: 0, lastFailureTime: null, lastSuccessTime: null, openedAt: null },
      };
      mockGetAllStates.mockReturnValue(states);

      const result = getCircuitBreakerStates();

      expect(result).toEqual(states);
      expect(getAllStates).toHaveBeenCalled();
    });
  });
});
