"use client";

import type { PaletteStep } from "@/lib/schemas/palette";

const VISIBLE_STEPS: PaletteStep[] = [
  "mood",
  "dominant",
  "accent",
  "neutrals",
  "review",
];

const STEP_LABELS: Record<PaletteStep, string> = {
  mood: "Mood",
  dominant: "Dominant",
  accent: "Accent",
  neutrals: "Neutrals",
  review: "Review",
  locked: "Locked",
};

export function PaletteProgressBar({ step }: { step: PaletteStep }) {
  const activeIndex =
    step === "locked" ? VISIBLE_STEPS.length - 1 : VISIBLE_STEPS.indexOf(step);

  return (
    <div className="flex items-center justify-center gap-2">
      {VISIBLE_STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full transition-colors ${
              i < activeIndex
                ? "bg-violet-400"
                : i === activeIndex
                  ? "bg-violet-300"
                  : "bg-zinc-700"
            }`}
            aria-label={STEP_LABELS[s]}
          />
          {i < VISIBLE_STEPS.length - 1 && (
            <span className="h-px w-4 bg-zinc-800" />
          )}
        </div>
      ))}
    </div>
  );
}
