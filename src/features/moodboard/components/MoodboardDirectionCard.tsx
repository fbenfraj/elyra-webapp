"use client";

import { motion } from "motion/react";
import { Heart, ArrowRight } from "lucide-react";
import type { DirectionWithUrl } from "@/lib/schemas/moodboard";

export function MoodboardDirectionCard({
  direction,
  isLiked,
  onLike,
  onSkip,
  isPending,
}: {
  direction: DirectionWithUrl;
  isLiked: boolean;
  onLike: () => void;
  onSkip: () => void;
  isPending: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-800"
    >
      {/* Hero image */}
      <div className="relative aspect-square w-full">
        <img
          src={direction.heroImageUrl}
          alt={direction.title}
          className="h-full w-full object-cover"
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Content overlay at bottom of image */}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <h3 className="text-lg font-semibold text-white">
            {direction.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/80">
            {direction.narrative}
          </p>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-2">
            {direction.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-3 py-0.5 text-xs text-white/70 backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Palette swatches */}
          <div className="mt-3 flex gap-1.5">
            {direction.colorPalette.map((hex, i) => (
              <div
                key={i}
                className="size-6 rounded-full border border-white/20"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 bg-zinc-950 px-6 py-4">
        <motion.button
          onClick={onLike}
          disabled={isPending}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
            isLiked
              ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
              : "bg-white/5 text-zinc-300 hover:bg-white/10"
          }`}
        >
          <Heart className={`size-4 ${isLiked ? "fill-red-400" : ""}`} />
          {isLiked ? "Liked" : "This feels right"}
        </motion.button>

        <motion.button
          onClick={onSkip}
          disabled={isPending}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/10"
        >
          <ArrowRight className="size-4" />
          Not my vibe
        </motion.button>
      </div>
    </motion.div>
  );
}
