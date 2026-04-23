import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

const mockGetHitRate = vi.fn();
const mockGetAverageCostPerDeliverable = vi.fn();

vi.mock("@/server/services/metrics", () => ({
  getHitRate: (...args: unknown[]) => mockGetHitRate(...args),
  getAverageCostPerDeliverable: (...args: unknown[]) => mockGetAverageCostPerDeliverable(...args),
}));

vi.mock("@/config/limits", () => ({
  ALERT_THRESHOLDS: {
    minHitRatePercent: 60,
    maxAvgCostCentsPerDeliverable: 50,
    maxProviderFailureRatePercent: 10,
  },
}));

describe("alerts service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("logs error when hit rate is below threshold", async () => {
    mockGetHitRate.mockResolvedValue(45);
    mockGetAverageCostPerDeliverable.mockResolvedValue(30);

    const { checkThresholds } = await import("@/server/services/alerts");
    await checkThresholds();

    expect(console.error).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(
      (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    );
    expect(loggedData.event).toBe("threshold_breach");
    expect(loggedData.metric).toBe("hit_rate");
    expect(loggedData.value).toBe(45);
  });

  it("logs error when avg cost exceeds threshold", async () => {
    mockGetHitRate.mockResolvedValue(80);
    mockGetAverageCostPerDeliverable.mockResolvedValue(75);

    const { checkThresholds } = await import("@/server/services/alerts");
    await checkThresholds();

    expect(console.error).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(
      (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    );
    expect(loggedData.event).toBe("threshold_breach");
    expect(loggedData.metric).toBe("avg_cost");
    expect(loggedData.value).toBe(75);
  });

  it("logs both errors when both thresholds are breached", async () => {
    mockGetHitRate.mockResolvedValue(30);
    mockGetAverageCostPerDeliverable.mockResolvedValue(80);

    const { checkThresholds } = await import("@/server/services/alerts");
    await checkThresholds();

    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("does not log when all metrics are healthy", async () => {
    mockGetHitRate.mockResolvedValue(80);
    mockGetAverageCostPerDeliverable.mockResolvedValue(30);

    const { checkThresholds } = await import("@/server/services/alerts");
    await checkThresholds();

    expect(console.error).not.toHaveBeenCalled();
  });

  it("does not log hit rate breach when hit rate is 0 (no data)", async () => {
    mockGetHitRate.mockResolvedValue(0);
    mockGetAverageCostPerDeliverable.mockResolvedValue(30);

    const { checkThresholds } = await import("@/server/services/alerts");
    await checkThresholds();

    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs error when metrics check fails", async () => {
    mockGetHitRate.mockRejectedValue(new Error("DB connection failed"));

    const { checkThresholds } = await import("@/server/services/alerts");
    await checkThresholds();

    expect(console.error).toHaveBeenCalledTimes(1);
    const loggedData = JSON.parse(
      (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    );
    expect(loggedData.event).toBe("threshold_check_failed");
  });
});
