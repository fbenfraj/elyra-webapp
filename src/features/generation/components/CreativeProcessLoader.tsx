"use client";

import { useState, useEffect } from "react";
import type { TimeoutLevel } from "@/config/generation-timeouts";
import {
  GenerationWaiting,
  PulseRings,
  CyclingStatus,
} from "@/features/generation/components/GenerationWaiting";

const DIRECTION_PHRASES = [
  "Interpreting your vision...",
  "Exploring visual directions...",
  "Curating the strongest options...",
];

interface CreativeProcessLoaderProps {
  briefText: string;
  timeoutLevel?: TimeoutLevel;
  onRetry?: () => void;
}

export function CreativeProcessLoader({
  briefText,
  timeoutLevel = "normal",
  onRetry,
}: CreativeProcessLoaderProps) {
  return (
    <GenerationWaiting briefText={briefText}>
      {timeoutLevel === "extended" ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg text-[var(--foreground)]">
            We hit a snag. Your brief is saved — try again?
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-[var(--radius-sm)] border border-[var(--foreground-subtle)] px-5 py-2.5 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            >
              Try again
            </button>
          )}
        </div>
      ) : timeoutLevel === "delayed" ? (
        <div className="flex flex-col items-center gap-6">
          <p className="text-lg text-[var(--foreground)]">
            Taking a bit longer than usual...
          </p>
          <PulseRings />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8">
          <CyclingStatus phrases={DIRECTION_PHRASES} />
          <PulseRings />
        </div>
      )}
    </GenerationWaiting>
  );
}
