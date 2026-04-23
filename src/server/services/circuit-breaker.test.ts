import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  recordSuccess,
  recordFailure,
  canExecute,
  getState,
  getAllStates,
  _resetAll,
} from "./circuit-breaker";

describe("circuit-breaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetAll();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in closed state for unknown provider", () => {
    const state = getState("test-provider");
    expect(state.state).toBe("closed");
    expect(state.failureCount).toBe(0);
  });

  it("allows execution when circuit is closed", () => {
    expect(canExecute("test-provider")).toBe(true);
  });

  it("stays closed under the failure threshold", () => {
    for (let i = 0; i < 4; i++) {
      recordFailure("test-provider");
    }
    const state = getState("test-provider");
    expect(state.state).toBe("closed");
    expect(state.failureCount).toBe(4);
    expect(canExecute("test-provider")).toBe(true);
  });

  it("opens after reaching the failure threshold", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure("test-provider");
    }
    const state = getState("test-provider");
    expect(state.state).toBe("open");
    expect(state.failureCount).toBe(5);
    expect(state.openedAt).not.toBeNull();
  });

  it("returns false from canExecute when circuit is open", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure("test-provider");
    }
    expect(canExecute("test-provider")).toBe(false);
  });

  it("transitions from open to half-open after cooldown", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure("test-provider");
    }
    expect(canExecute("test-provider")).toBe(false);

    // Advance past cooldown (30s)
    vi.advanceTimersByTime(30_000);

    expect(canExecute("test-provider")).toBe(true);
    const state = getState("test-provider");
    expect(state.state).toBe("half-open");
  });

  it("closes circuit after successful half-open request", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure("test-provider");
    }

    // Advance past cooldown
    vi.advanceTimersByTime(30_000);
    canExecute("test-provider"); // transitions to half-open

    recordSuccess("test-provider");
    const state = getState("test-provider");
    expect(state.state).toBe("closed");
    expect(state.failureCount).toBe(0);
    expect(state.openedAt).toBeNull();
  });

  it("re-opens circuit after failed half-open request", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure("test-provider");
    }

    // Advance past cooldown
    vi.advanceTimersByTime(30_000);
    canExecute("test-provider"); // transitions to half-open

    // Record enough failures to re-open (already at 5, one more puts it at 6)
    recordFailure("test-provider");
    const state = getState("test-provider");
    expect(state.state).toBe("open");
  });

  it("resets failure count on success", () => {
    recordFailure("test-provider");
    recordFailure("test-provider");
    recordSuccess("test-provider");
    const state = getState("test-provider");
    expect(state.failureCount).toBe(0);
    expect(state.lastSuccessTime).not.toBeNull();
  });

  it("_resetAll clears all circuit state", () => {
    recordFailure("provider-a");
    recordFailure("provider-b");
    _resetAll();
    const states = getAllStates();
    expect(Object.keys(states)).toHaveLength(0);
  });

  it("getAllStates returns all tracked providers", () => {
    recordFailure("provider-a");
    recordSuccess("provider-b");
    const states = getAllStates();
    expect(Object.keys(states)).toContain("provider-a");
    expect(Object.keys(states)).toContain("provider-b");
  });

  it("returns copies from getState, not references", () => {
    recordFailure("test-provider");
    const state1 = getState("test-provider");
    state1.failureCount = 999;
    const state2 = getState("test-provider");
    expect(state2.failureCount).toBe(1);
  });
});
