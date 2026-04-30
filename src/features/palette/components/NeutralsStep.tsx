"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import type { NeutralsSuggestion } from "@/lib/schemas/palette";

const NEUTRAL_LABELS = ["Deepest", "Mid", "Lightest"] as const;

type Props = {
  initialNeutrals: [string, string, string] | null;
  dominant: string;
  accent: string;
  onPicked: (neutrals: [string, string, string]) => void;
};

export function NeutralsStep({
  initialNeutrals,
  dominant,
  accent,
  onPicked,
}: Props) {
  const trpc = useTRPC();
  const [neutrals, setNeutrals] = useState<[string, string, string] | null>(
    initialNeutrals
  );
  const [rationale, setRationale] = useState<string | null>(null);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);

  const suggest = useMutation(
    trpc.palette.suggestNeutrals.mutationOptions({
      onSuccess: (data: NeutralsSuggestion) => {
        if (swappingIndex === null) {
          setNeutrals([data.neutrals[0], data.neutrals[1], data.neutrals[2]]);
          setRationale(data.rationale);
        } else {
          setNeutrals((curr) => {
            if (!curr) {
              return [data.neutrals[0], data.neutrals[1], data.neutrals[2]];
            }
            const next: [string, string, string] = [...curr];
            next[swappingIndex] = data.neutrals[swappingIndex];
            return next;
          });
        }
        setSwappingIndex(null);
      },
      onError: () => {
        toast.error("Couldn't load neutrals. Try again.");
        setSwappingIndex(null);
      },
    })
  );

  const setNeutralsMutation = useMutation(
    trpc.palette.setNeutrals.mutationOptions({
      onError: () => toast.error("Couldn't save neutrals. Try again."),
    })
  );

  useEffect(() => {
    if (!neutrals && !suggest.isPending) {
      suggest.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function swapSlot(index: number) {
    setSwappingIndex(index);
    suggest.mutate();
  }

  function handleConfirm() {
    if (!neutrals) return;
    setNeutralsMutation.mutate(
      { hexes: neutrals },
      { onSuccess: () => onPicked(neutrals) }
    );
  }

  function regenerateAll() {
    setSwappingIndex(null);
    suggest.mutate();
  }

  if (!neutrals && suggest.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="size-7 animate-spin text-violet-300" />
        <p className="text-sm text-zinc-400">Tuning the neutrals…</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <p className="text-center text-xs font-medium uppercase tracking-widest text-violet-400/80">
        Step 4 / 5
      </p>
      <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight text-white">
        Lock the neutrals
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-zinc-400">
        Three supporting tones — deepest dark, mid, lightest — that stay quiet so
        your dominant and accent can sing.
      </p>

      <div className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2">
        <span
          className="size-4 rounded-md border border-white/10"
          style={{ backgroundColor: dominant }}
          aria-label="Dominant"
        />
        <span
          className="size-4 rounded-md border border-white/10"
          style={{ backgroundColor: accent }}
          aria-label="Accent"
        />
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          + 3 neutrals
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {neutrals?.map((hex, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-zinc-800"
          >
            <div
              className="h-32 w-full"
              style={{ backgroundColor: hex }}
              aria-hidden
            />
            <div className="space-y-2 px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-300">
                  {NEUTRAL_LABELS[i]}
                </span>
                <span className="font-mono text-[11px] uppercase text-zinc-500">
                  {hex}
                </span>
              </div>
              <Button
                variant="ghost-secondary"
                size="xs"
                onClick={() => swapSlot(i)}
                disabled={suggest.isPending}
                className="w-full"
              >
                {suggest.isPending && swappingIndex === i ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Swap
              </Button>
            </div>
          </div>
        ))}
      </div>

      {rationale && (
        <p className="mx-auto mt-6 max-w-lg text-center text-xs italic text-zinc-500">
          {rationale}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost-secondary"
          size="sm"
          onClick={regenerateAll}
          disabled={suggest.isPending}
        >
          Regenerate all
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!neutrals || setNeutralsMutation.isPending}
        >
          {setNeutralsMutation.isPending && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          Continue
        </Button>
      </div>
    </motion.div>
  );
}
