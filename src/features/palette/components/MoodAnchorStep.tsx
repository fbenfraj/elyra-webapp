"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import type {
  MoodAnchor,
  MoodAnchorSuggestions,
} from "@/lib/schemas/palette";

type Props = {
  initialAnchor: MoodAnchor | null;
  onPicked: (anchor: MoodAnchor) => void;
};

export function MoodAnchorStep({ initialAnchor, onPicked }: Props) {
  const trpc = useTRPC();
  const [suggestions, setSuggestions] = useState<MoodAnchorSuggestions | null>(
    null
  );
  const [selected, setSelected] = useState<MoodAnchor | null>(initialAnchor);

  const suggest = useMutation(
    trpc.palette.suggestMoodAnchors.mutationOptions({
      onSuccess: (data) => setSuggestions(data),
      onError: () => toast.error("Couldn't load mood anchors. Try again."),
    })
  );

  const setAnchor = useMutation(
    trpc.palette.setMoodAnchor.mutationOptions({
      onError: () => toast.error("Couldn't save your choice. Try again."),
    })
  );

  useEffect(() => {
    if (!suggestions && !suggest.isPending) {
      suggest.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirm() {
    if (!selected) return;
    setAnchor.mutate(
      { anchor: selected },
      {
        onSuccess: () => onPicked(selected),
      }
    );
  }

  if (suggest.isPending || !suggestions) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="size-7 animate-spin text-violet-300" />
        <p className="text-sm text-zinc-400">
          Reading your sound, drafting mood anchors…
        </p>
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
        Step 1 / 5
      </p>
      <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight text-white">
        Pick a mood anchor
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-zinc-400">
        This is the emotional temperature of your palette. Every color we suggest
        next will respect this choice.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {suggestions.anchors.map((anchor) => {
          const isSelected = selected?.id === anchor.id;
          return (
            <motion.button
              key={anchor.id}
              type="button"
              onClick={() => setSelected(anchor)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`relative overflow-hidden rounded-2xl border text-left transition-colors ${
                isSelected
                  ? "border-violet-400/70 ring-2 ring-violet-400/30"
                  : "border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <div
                className="h-24 w-full"
                style={{
                  background: `linear-gradient(110deg, ${anchor.previewHexes[0]} 0%, ${anchor.previewHexes[1]} 55%, ${anchor.previewHexes[2]} 100%)`,
                }}
                aria-hidden
              />
              {isSelected && (
                <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-white/90 text-zinc-900">
                  <Check className="size-3.5" />
                </span>
              )}
              <div className="space-y-1.5 px-5 py-4">
                <h3 className="text-base font-semibold text-white">
                  {anchor.label}
                </h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {anchor.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[anchor.temperature, anchor.brightness, anchor.saturation].map(
                    (t) => (
                      <span
                        key={t}
                        className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400"
                      >
                        {t}
                      </span>
                    )
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost-secondary"
          size="sm"
          onClick={() => suggest.mutate()}
          disabled={suggest.isPending}
        >
          Suggest others
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!selected || setAnchor.isPending}
        >
          {setAnchor.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Continue
        </Button>
      </div>
    </motion.div>
  );
}
