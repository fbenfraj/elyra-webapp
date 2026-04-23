"use client";

import { useState, useRef, useEffect } from "react";

const RECOVERY_PILLS = [
  "Grittier?",
  "Darker?",
  "More abstract?",
  "More minimal?",
  "More raw?",
] as const;

interface RecoveryFlowProps {
  onSubmit: (data: {
    selectedPills: string[];
    refinementText: string;
  }) => void;
  isSubmitting: boolean;
  onPillSelected?: (pill: string) => void;
}

export function RecoveryFlow({ onSubmit, isSubmitting, onPillSelected }: RecoveryFlowProps) {
  const [selectedPills, setSelectedPills] = useState<Set<string>>(new Set());
  const [refinementText, setRefinementText] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading when component mounts (accessibility)
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const togglePill = (pill: string) => {
    setSelectedPills((prev) => {
      const next = new Set(prev);
      if (next.has(pill)) {
        next.delete(pill);
      } else {
        next.add(pill);
        onPillSelected?.(pill);
      }
      return next;
    });
  };

  const hasInput = selectedPills.size > 0 || refinementText.trim().length > 0;

  const handleSubmit = () => {
    if (!hasInput || isSubmitting) return;
    onSubmit({
      selectedPills: Array.from(selectedPills),
      refinementText: refinementText.trim(),
    });
  };

  return (
    <div
      className="w-full max-w-[var(--content-narrow)] motion-safe:animate-[recoveryFadeIn_var(--duration-normal,200ms)_var(--ease-enter,ease-out)]"
    >
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)] outline-none"
      >
        Let&apos;s try a different angle
      </h2>

      {/* Suggestion pills */}
      <div className="mt-[var(--space-6)] flex flex-wrap gap-[var(--space-3)]">
        {RECOVERY_PILLS.map((pill) => {
          const isSelected = selectedPills.has(pill);
          return (
            <button
              key={pill}
              type="button"
              role="button"
              aria-pressed={isSelected}
              onClick={() => togglePill(pill)}
              className="min-h-[44px] rounded-[var(--radius-full)] px-[var(--space-4)] py-[var(--space-2)] text-sm font-medium transition-colors"
              style={{
                backgroundColor: isSelected
                  ? "rgba(228,228,231,0.1)"
                  : "var(--background-overlay)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: isSelected ? "var(--accent)" : "transparent",
                color: isSelected
                  ? "var(--foreground)"
                  : "var(--foreground-muted)",
                transitionDuration: "var(--duration-fast, 150ms)",
              }}
            >
              {pill}
            </button>
          );
        })}
      </div>

      {/* Text input */}
      <div className="mt-[var(--space-6)]">
        <label htmlFor="recovery-input" className="sr-only">
          Describe what you are looking for
        </label>
        <input
          id="recovery-input"
          type="text"
          placeholder="Or describe what you're looking for"
          value={refinementText}
          onChange={(e) => setRefinementText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent px-[var(--space-4)] py-[var(--space-3)] text-base text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--accent)] transition-colors"
          style={{ transitionDuration: "var(--duration-fast, 150ms)" }}
        />
        <p className="mt-[var(--space-2)] text-sm text-[var(--foreground-subtle)]">
          try naming an artist or album that captures what you&apos;re after
        </p>
      </div>

      {/* Submit button */}
      <div className="mt-[var(--space-6)] flex justify-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasInput || isSubmitting}
          className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent px-[var(--space-6)] text-sm font-medium text-[var(--accent)] transition-all hover:bg-[var(--background-overlay)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          style={{ transitionDuration: "var(--duration-fast, 150ms)" }}
        >
          Try this angle
        </button>
      </div>

      <style>{`
        @keyframes recoveryFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
