import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockCanExecute, mockRecordSuccess, mockRecordFailure } = vi.hoisted(() => ({
  mockCanExecute: vi.fn(),
  mockRecordSuccess: vi.fn(),
  mockRecordFailure: vi.fn(),
}));

vi.mock("@/server/services/circuit-breaker", () => ({
  canExecute: mockCanExecute,
  recordSuccess: mockRecordSuccess,
  recordFailure: mockRecordFailure,
}));

vi.mock("@/config/providers", () => ({
  RETRY_CONFIG: {
    providerA: { maxRetries: 1, retryDelayMs: 100, timeoutMs: 30_000 },
    providerB: { maxRetries: 1, retryDelayMs: 100, timeoutMs: 30_000 },
  },
}));

vi.mock("@/server/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/server/db/schema/provider-metrics", () => ({
  providerMetrics: {},
}));

import { executeWithFallback, AllProvidersFailedError } from "./provider-executor";

describe("provider-executor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCanExecute.mockReturnValue(true);
    mockRecordSuccess.mockClear();
    mockRecordFailure.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result from first provider on success", async () => {
    const executeFn = vi.fn().mockResolvedValue("success");

    const result = await executeWithFallback(
      ["providerA"],
      executeFn,
    );

    expect(result).toBe("success");
    expect(executeFn).toHaveBeenCalledWith("providerA");
    expect(mockRecordSuccess).toHaveBeenCalledWith("providerA");
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });

  it("retries on failure then succeeds", async () => {
    const executeFn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockResolvedValueOnce("success");

    const promise = executeWithFallback(
      ["providerA"],
      executeFn,
    );

    // Advance past retry delay
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe("success");
    expect(executeFn).toHaveBeenCalledTimes(2);
    expect(mockRecordSuccess).toHaveBeenCalledWith("providerA");
  });

  it("falls back to second provider when first exhausts retries", async () => {
    const executeFn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValueOnce("fallback-success");

    const promise = executeWithFallback(
      ["providerA", "providerB"],
      executeFn,
      { sessionId: "test-session" },
    );

    // Advance past all retry delays
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe("fallback-success");
    expect(mockRecordFailure).toHaveBeenCalledWith("providerA");
    expect(mockRecordSuccess).toHaveBeenCalledWith("providerB");
  });

  it("skips provider with open circuit", async () => {
    mockCanExecute.mockImplementation((provider: string) => provider !== "providerA");
    const executeFn = vi.fn().mockResolvedValue("from-B");

    const result = await executeWithFallback(
      ["providerA", "providerB"],
      executeFn,
    );

    expect(result).toBe("from-B");
    expect(executeFn).not.toHaveBeenCalledWith("providerA");
    expect(executeFn).toHaveBeenCalledWith("providerB");
  });

  it("throws AllProvidersFailedError when all providers fail", async () => {
    const executeFn = vi.fn().mockRejectedValue(new Error("total-fail"));

    const promise = executeWithFallback(
      ["providerA", "providerB"],
      executeFn,
    ).catch((err) => err); // Catch immediately to prevent unhandled rejection

    // Advance past all retry delays
    await vi.advanceTimersByTimeAsync(5000);

    const caughtError = await promise;

    expect(caughtError).toBeInstanceOf(AllProvidersFailedError);
    expect((caughtError as AllProvidersFailedError).providers).toEqual(["providerA", "providerB"]);
    expect(mockRecordFailure).toHaveBeenCalledWith("providerA");
    expect(mockRecordFailure).toHaveBeenCalledWith("providerB");
  });

  it("throws AllProvidersFailedError when all circuits are open", async () => {
    mockCanExecute.mockReturnValue(false);

    await expect(
      executeWithFallback(["providerA", "providerB"], vi.fn())
    ).rejects.toThrow(AllProvidersFailedError);
  });

  it("uses exponential backoff delays", async () => {
    const executeFn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"));

    const promise = executeWithFallback(
      ["providerA"],
      executeFn,
    ).catch((err) => err); // Catch to prevent unhandled rejection

    // First retry delay: 100 * 2^0 = 100ms
    await vi.advanceTimersByTimeAsync(50);
    expect(executeFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60);
    expect(executeFn).toHaveBeenCalledTimes(2);

    // All retries exhausted, should have rejected
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBeInstanceOf(AllProvidersFailedError);
  });

  it("logs fallback events", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const executeFn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValueOnce("ok");

    const promise = executeWithFallback(
      ["providerA", "providerB"],
      executeFn,
      { sessionId: "test-session" },
    );

    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    const fallbackLog = warnSpy.mock.calls.find((call) => {
      const parsed = JSON.parse(call[0] as string);
      return parsed.event === "provider_fallback";
    });

    expect(fallbackLog).toBeDefined();
    const parsed = JSON.parse(fallbackLog![0] as string);
    expect(parsed.provider).toBe("providerA");
    expect(parsed.fallbackProvider).toBe("providerB");
    expect(parsed.sessionId).toBe("test-session");

    warnSpy.mockRestore();
  });

  it("logs when skipping provider due to open circuit", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCanExecute.mockImplementation((provider: string) => provider !== "providerA");
    const executeFn = vi.fn().mockResolvedValue("ok");

    await executeWithFallback(
      ["providerA", "providerB"],
      executeFn,
    );

    const skipLog = warnSpy.mock.calls.find((call) => {
      const parsed = JSON.parse(call[0] as string);
      return parsed.event === "provider_skipped_circuit_open";
    });

    expect(skipLog).toBeDefined();
    const parsed = JSON.parse(skipLog![0] as string);
    expect(parsed.provider).toBe("providerA");

    warnSpy.mockRestore();
  });
});
