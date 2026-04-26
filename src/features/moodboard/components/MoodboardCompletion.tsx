"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { MoodboardSpec } from "@/lib/schemas/moodboard";

export function MoodboardCompletion({
  spec,
}: {
  spec: MoodboardSpec;
}) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex w-full max-w-2xl flex-col items-center gap-8"
    >
      {/* Success icon */}
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-950/50 ring-1 ring-emerald-800/40">
        <Check className="size-7 text-emerald-400" />
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-zinc-100">
          Visual identity saved
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          You can update this anytime from Settings.
        </p>
      </div>

      {/* Creative direction summary */}
      <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-sm font-medium text-zinc-300">{spec.coreIdea}</p>
        <p className="mt-1 text-xs text-zinc-500 italic">{spec.duality}</p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          {spec.narrative}
        </p>

        {/* Palette + tags */}
        <div className="mt-5 flex items-center gap-4">
          <div className="flex gap-1.5">
            {spec.palette.map((hex, i) => (
              <div
                key={i}
                className="size-7 rounded-lg border border-zinc-700/50"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {spec.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] text-zinc-500"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <motion.button
        onClick={() => router.push("/dashboard")}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
      >
        Start creating
      </motion.button>
    </motion.div>
  );
}
