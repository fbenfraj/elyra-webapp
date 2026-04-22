"use client";

import { useState, useEffect } from "react";

const DIRECTION_PHRASES = [
  "Interpreting your vision...",
  "Exploring visual directions...",
  "Curating the strongest options...",
];

const CYCLE_INTERVAL_MS = 4000;

export function CreativeProcessLoader({ briefText }: { briefText: string }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
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
  }, [prefersReducedMotion]);

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
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
