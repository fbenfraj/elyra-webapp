"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  TIMEOUT_DELAYED_MS,
  EXTENDED_TIMEOUT_BY_PHASE,
  type TimeoutLevel,
  type GenerationPhase,
} from "@/config/generation-timeouts";

export interface UseGenerationStatusOptions {
  phase: GenerationPhase;
}

export interface UseGenerationStatusReturn {
  timeoutLevel: TimeoutLevel;
  elapsed: number;
  reset: () => void;
}

/**
 * Tracks elapsed time since a generation phase started and computes the
 * current timeout level. Call `reset()` on retry to restart tracking.
 */
export function useGenerationStatus({
  phase,
}: UseGenerationStatusOptions): UseGenerationStatusReturn {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Tick every second to update elapsed
    intervalRef.current = setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  const elapsed = now - startedAt;
  const extendedThreshold = EXTENDED_TIMEOUT_BY_PHASE[phase];

  const timeoutLevel: TimeoutLevel = useMemo(() => {
    if (elapsed >= extendedThreshold) return "extended";
    if (elapsed >= TIMEOUT_DELAYED_MS) return "delayed";
    return "normal";
  }, [elapsed, extendedThreshold]);

  const reset = useCallback(() => {
    setStartedAt(Date.now());
    setNow(Date.now());
  }, []);

  return { timeoutLevel, elapsed, reset };
}
