"use client";

import { motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Pencil, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import type { MoodAnchor } from "@/lib/schemas/palette";

type Props = {
  moodAnchor: MoodAnchor;
  dominant: string;
  accent: string;
  neutrals: [string, string, string];
  onEdit: () => void;
};

export function LockedSummary({
  moodAnchor,
  dominant,
  accent,
  neutrals,
  onEdit,
}: Props) {
  const trpc = useTRPC();

  const unlock = useMutation(
    trpc.palette.editLocked.mutationOptions({
      onSuccess: () => onEdit(),
      onError: () => toast.error("Couldn't open edit mode. Try again."),
    })
  );

  const allColors = [neutrals[0], dominant, accent, neutrals[1], neutrals[2]];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Link
        href="/dashboard/moodboard"
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-3.5" />
        Back to moodboard
      </Link>

      <p className="text-xs font-medium uppercase tracking-widest text-violet-400/80">
        Palette · Locked
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
        {moodAnchor.label}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-400">
        {moodAnchor.description}
      </p>

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

      <div className="mt-8">
        <Button
          variant="ghost-secondary"
          onClick={() => unlock.mutate()}
          disabled={unlock.isPending}
        >
          {unlock.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Pencil className="size-3.5" />
          )}
          Edit palette
        </Button>
      </div>
    </motion.div>
  );
}
