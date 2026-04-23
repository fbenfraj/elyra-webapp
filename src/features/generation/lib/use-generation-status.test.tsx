import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGenerationStatus } from "./use-generation-status";

describe("useGenerationStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with normal timeout level", () => {
    const { result } = renderHook(() =>
      useGenerationStatus({ phase: "generating_directions" })
    );
    expect(result.current.timeoutLevel).toBe("normal");
    expect(result.current.elapsed).toBe(0);
  });

  it("transitions to delayed at 120s", () => {
    const { result } = renderHook(() =>
      useGenerationStatus({ phase: "generating_directions" })
    );

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(result.current.timeoutLevel).toBe("delayed");
  });

  it("transitions to extended at 180s for direction generation", () => {
    const { result } = renderHook(() =>
      useGenerationStatus({ phase: "generating_directions" })
    );

    act(() => {
      vi.advanceTimersByTime(180_000);
    });

    expect(result.current.timeoutLevel).toBe("extended");
  });

  it("transitions to extended at 240s for packaging", () => {
    const { result } = renderHook(() =>
      useGenerationStatus({ phase: "packaging" })
    );

    // At 180s should still be delayed (not extended) for packaging
    act(() => {
      vi.advanceTimersByTime(180_000);
    });
    expect(result.current.timeoutLevel).toBe("delayed");

    // At 240s should be extended
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.timeoutLevel).toBe("extended");
  });

  it("resets timeout tracking on reset()", () => {
    const { result } = renderHook(() =>
      useGenerationStatus({ phase: "generating_directions" })
    );

    act(() => {
      vi.advanceTimersByTime(130_000);
    });
    expect(result.current.timeoutLevel).toBe("delayed");

    act(() => {
      result.current.reset();
    });

    expect(result.current.timeoutLevel).toBe("normal");
    expect(result.current.elapsed).toBe(0);
  });
});
