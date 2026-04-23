"use client";

import { useState, useEffect } from "react";
import type { TimeoutLevel } from "@/config/generation-timeouts";

const DIRECTION_PHRASES = [
  "Interpreting your vision...",
  "Exploring visual directions...",
  "Curating the strongest options...",
];

const CYCLE_INTERVAL_MS = 4000;

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
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    // Stop cycling when extended — we show static retry UI
    if (timeoutLevel === "extended") return;

    const interval = setInterval(() => {
      if (prefersReducedMotion) {
        setPhraseIndex((prev) => (prev + 1) % DIRECTION_PHRASES.length);
      } else {
        setIsVisible(false);
        setTimeout(() => {
          setPhraseIndex((prev) => (prev + 1) % DIRECTION_PHRASES.length);
          setIsVisible(true);
        }, 500);
      }
    }, CYCLE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [prefersReducedMotion, timeoutLevel]);

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
      {/* Abstract gradient background */}
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="h-full w-full bg-gradient-to-br from-[#1a1a2e] via-[#09090b] to-[#16213e]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[var(--content-narrow)]">
        {/* Brief display */}
        <p className="text-sm text-[var(--foreground-muted)]">Your brief</p>
        <p className="mt-1 text-base text-[var(--foreground)]">{briefText}</p>

        {/* Narrative text */}
        <div
          aria-live="polite"
          className="mt-12 flex flex-col items-center"
        >
          {timeoutLevel === "extended" ? (
            <>
              <p className="text-lg text-[var(--foreground)]">
                We hit a snag. Your brief is saved — try again?
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-6 rounded-md border border-[var(--foreground-subtle)] px-4 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                >
                  Try again
                </button>
              )}
            </>
          ) : timeoutLevel === "delayed" ? (
            <>
              <p className="text-lg text-[var(--foreground)]">
                Taking a bit longer than usual...
              </p>
              {/* Pulsing dot indicator for delayed state */}
              {!prefersReducedMotion && (
                <div
                  className="mt-8 h-2 w-2 rounded-full"
                  data-testid="delayed-pulse"
                  style={{
                    backgroundColor: "var(--foreground-subtle)",
                    opacity: 0.6,
                    animation: "delayedPulse 1s ease-in-out infinite",
                  }}
                />
              )}
            </>
          ) : (
            <>
              <p
                className="text-lg text-[var(--foreground)]"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transition: prefersReducedMotion
                    ? "none"
                    : "opacity var(--duration-slow, 500ms) ease-in-out",
                }}
              >
                {DIRECTION_PHRASES[phraseIndex]}
              </p>

              {/* Pulse element */}
              {!prefersReducedMotion && (
                <div
                  className="mt-8 h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: "var(--foreground-subtle)",
                    opacity: 0.4,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0.2; }
        }
        @keyframes delayedPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.8); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
