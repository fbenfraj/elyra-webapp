"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft } from "lucide-react";

import { useTRPC } from "@/lib/trpc/client";
import { MoodAnchorStep } from "@/features/palette/components/MoodAnchorStep";
import { SwatchPickStep } from "@/features/palette/components/SwatchPickStep";
import { NeutralsStep } from "@/features/palette/components/NeutralsStep";
import { ReviewStep } from "@/features/palette/components/ReviewStep";
import { LockedSummary } from "@/features/palette/components/LockedSummary";
import { PaletteProgressBar } from "@/features/palette/components/PaletteProgressBar";
import type { MoodAnchor, PaletteRow } from "@/lib/schemas/palette";

export function PaletteFlow() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryOpts = trpc.palette.current.queryOptions();
  const { data: palette, isLoading, refetch } = useQuery(queryOpts);

  const startOrResume = useMutation(
    trpc.palette.startOrResume.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const jumpToStep = useMutation(
    trpc.palette.jumpToStep.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  useEffect(() => {
    if (!isLoading && !palette && !startOrResume.isPending) {
      startOrResume.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, palette]);

  if (isLoading || !palette) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Loader2 className="size-7 animate-spin text-violet-300" />
        <p className="text-sm text-zinc-400">Loading your palette…</p>
      </div>
    );
  }

  const headerLink = (
    <Link
      href="/dashboard/moodboard"
      className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
    >
      <ArrowLeft className="size-3.5" />
      Back to moodboard
    </Link>
  );

  if (palette.status === "locked") {
    if (
      !palette.moodAnchor ||
      !palette.dominant ||
      !palette.accent ||
      !palette.neutrals
    ) {
      // Defensive — should never happen since lockPalette validates completeness.
      return null;
    }
    return (
      <LockedSummary
        moodAnchor={palette.moodAnchor}
        dominant={palette.dominant}
        accent={palette.accent}
        neutrals={[
          palette.neutrals[0],
          palette.neutrals[1],
          palette.neutrals[2],
        ]}
        onEdit={() => refetch()}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col"
    >
      {headerLink}
      <div className="mb-8">
        <PaletteProgressBar step={palette.step} />
      </div>

      {palette.step === "mood" && (
        <MoodAnchorStep
          initialAnchor={palette.moodAnchor}
          onPicked={() => refetch()}
        />
      )}

      {palette.step === "dominant" && palette.moodAnchor && (
        <SwatchPickStep
          kind="dominant"
          stepNumber={2}
          initialHex={palette.dominant}
          moodAnchor={palette.moodAnchor}
          onPicked={() => refetch()}
        />
      )}

      {palette.step === "accent" &&
        palette.moodAnchor &&
        palette.dominant && (
          <SwatchPickStep
            kind="accent"
            stepNumber={3}
            initialHex={palette.accent}
            moodAnchor={palette.moodAnchor}
            dominant={palette.dominant}
            onPicked={() => refetch()}
          />
        )}

      {palette.step === "neutrals" && palette.dominant && palette.accent && (
        <NeutralsStep
          initialNeutrals={
            palette.neutrals
              ? [palette.neutrals[0], palette.neutrals[1], palette.neutrals[2]]
              : null
          }
          dominant={palette.dominant}
          accent={palette.accent}
          onPicked={() => refetch()}
        />
      )}

      {palette.step === "review" &&
        palette.moodAnchor &&
        palette.dominant &&
        palette.accent &&
        palette.neutrals && (
          <ReviewStep
            moodAnchor={palette.moodAnchor}
            dominant={palette.dominant}
            accent={palette.accent}
            neutrals={[
              palette.neutrals[0],
              palette.neutrals[1],
              palette.neutrals[2],
            ]}
            onLocked={() => {
              refetch();
              router.push("/dashboard/moodboard");
            }}
            onBack={() => jumpToStep.mutate({ step: "neutrals" })}
          />
        )}

      {/* Defensive: if step indicates a stage but required data is missing, fall back */}
      {!isStepRenderable(palette) && (
        <FallbackResumeNotice
          onReset={() => jumpToStep.mutate({ step: "mood" })}
        />
      )}
    </motion.div>
  );
}

function isStepRenderable(p: PaletteRow): boolean {
  switch (p.step) {
    case "mood":
      return true;
    case "dominant":
      return p.moodAnchor !== null;
    case "accent":
      return p.moodAnchor !== null && p.dominant !== null;
    case "neutrals":
      return p.dominant !== null && p.accent !== null;
    case "review":
      return (
        p.moodAnchor !== null &&
        p.dominant !== null &&
        p.accent !== null &&
        p.neutrals !== null
      );
    case "locked":
      return true;
  }
}

function FallbackResumeNotice({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
      <p className="text-sm text-zinc-300">
        Your palette is in an inconsistent state. Restart from the top?
      </p>
      <button
        onClick={onReset}
        className="mt-4 text-sm font-medium text-violet-300 underline-offset-4 hover:underline"
      >
        Start over
      </button>
    </div>
  );
}
