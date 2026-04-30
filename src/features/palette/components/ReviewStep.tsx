"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import type { MoodAnchor } from "@/lib/schemas/palette";

type Props = {
  moodAnchor: MoodAnchor;
  dominant: string;
  accent: string;
  neutrals: [string, string, string];
  onLocked: () => void;
  onBack: () => void;
};

export function ReviewStep({
  moodAnchor,
  dominant,
  accent,
  neutrals,
  onLocked,
  onBack,
}: Props) {
  const trpc = useTRPC();
  const [confirming, setConfirming] = useState(false);

  const lock = useMutation(
    trpc.palette.lock.mutationOptions({
      onSuccess: () => onLocked(),
      onError: () => {
        toast.error("Couldn't lock the palette. Try again.");
        setConfirming(false);
      },
    })
  );

  const allColors = [neutrals[0], dominant, accent, neutrals[1], neutrals[2]];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <p className="text-center text-xs font-medium uppercase tracking-widest text-violet-400/80">
        Step 5 / 5 — Review
      </p>
      <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight text-white">
        Your palette
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-zinc-400">
        Five colors that anchor every cover from here on. You can edit anytime.
      </p>

      {/* Big swatch row */}
      <div className="mt-8 flex h-28 w-full overflow-hidden rounded-2xl border border-zinc-800">
        {allColors.map((hex, i) => (
          <div
            key={i}
            className="relative flex-1 transition-[flex] hover:flex-[1.4]"
            style={{ backgroundColor: hex }}
          >
            <span className="absolute bottom-2 left-2 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-white/90 backdrop-blur-sm">
              {hex}
            </span>
          </div>
        ))}
      </div>

      {/* Sample composition */}
      <div
        className="relative mt-6 overflow-hidden rounded-2xl border border-zinc-800"
        style={{
          background: `linear-gradient(135deg, ${dominant} 0%, ${neutrals[0]} 100%)`,
        }}
      >
        <div className="px-8 py-12">
          <span
            className="inline-block rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-widest"
            style={{
              backgroundColor: accent,
              color: neutrals[2],
            }}
          >
            Single · 2026
          </span>
          <h3
            className="mt-4 text-3xl font-semibold tracking-tight"
            style={{ color: neutrals[2] }}
          >
            {moodAnchor.label}
          </h3>
          <p
            className="mt-2 max-w-md text-sm leading-relaxed"
            style={{ color: neutrals[1] }}
          >
            A sample composition rendered in your palette. Cover artwork, type,
            and accents will sit inside this color world.
          </p>
        </div>
      </div>

      {!confirming ? (
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost-secondary" size="sm" onClick={onBack}>
            <ArrowLeft className="size-3.5" />
            Back to neutrals
          </Button>
          <Button onClick={() => setConfirming(true)}>
            <Lock className="size-3.5" />
            Lock palette
          </Button>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5">
          <p className="text-sm text-zinc-200">
            Lock this palette? It becomes the canonical palette behind every
            future cover. You can always edit it later.
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="ghost-secondary"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={lock.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => lock.mutate()}
              disabled={lock.isPending}
            >
              {lock.isPending && <Loader2 className="size-3.5 animate-spin" />}
              <Lock className="size-3.5" />
              Lock it in
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
