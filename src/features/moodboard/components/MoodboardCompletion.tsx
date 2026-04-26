"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { MoodboardSpec } from "@/lib/schemas/moodboard";
import { MoodboardSpecSummary } from "@/features/moodboard/components/MoodboardSpecSummary";

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

      <div className="w-full space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <MoodboardSpecSummary spec={spec} />
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
