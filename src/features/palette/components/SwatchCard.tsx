"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { SwatchSuggestion } from "@/lib/schemas/palette";

type Props = {
  swatch: SwatchSuggestion;
  selected: boolean;
  onSelect: () => void;
};

export function SwatchCard({ swatch, selected, onSelect }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative overflow-hidden rounded-2xl border text-left transition-colors ${
        selected
          ? "border-violet-400/70 ring-2 ring-violet-400/30"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div
        className="h-28 w-full"
        style={{ backgroundColor: swatch.hex }}
        aria-hidden
      />
      {selected && (
        <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-white/90 text-zinc-900">
          <Check className="size-3.5" />
        </span>
      )}
      <div className="space-y-1 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-white">{swatch.label}</span>
          <span className="font-mono text-[11px] uppercase text-zinc-500">
            {swatch.hex}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">{swatch.rationale}</p>
      </div>
    </motion.button>
  );
}
