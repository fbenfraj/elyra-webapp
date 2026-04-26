"use client";

import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

export function MoodboardIntro({
  artistName,
  artistGenres,
  failed,
  onRetry,
}: {
  artistName: string | null;
  artistGenres: string[] | null;
  failed: boolean;
  onRetry: () => void;
}) {
  if (failed) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-950/40 ring-1 ring-red-800/40">
          <span className="text-2xl">!</span>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            We couldn&apos;t generate your visual directions. This is usually temporary.
          </p>
        </div>
        <motion.button
          onClick={onRetry}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-900"
        >
          Try again
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Loader2 className="size-10 animate-spin text-zinc-500" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h2 className="text-xl font-semibold text-zinc-100">
          Creating your visual world
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {artistName
            ? `Analyzing ${artistName}'s sound to generate 6 unique visual directions...`
            : "Generating 6 unique visual directions..."}
        </p>
        {artistGenres && artistGenres.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {artistGenres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="rounded-full bg-white/8 px-3 py-0.5 text-xs text-zinc-500"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
