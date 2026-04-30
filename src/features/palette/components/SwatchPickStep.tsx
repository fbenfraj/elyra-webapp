"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Pipette, Check, X } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { SwatchCard } from "@/features/palette/components/SwatchCard";
import type {
  MoodAnchor,
  SwatchSuggestion,
  SwatchSuggestions,
} from "@/lib/schemas/palette";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

type Props = {
  kind: "dominant" | "accent";
  stepNumber: 2 | 3;
  initialHex: string | null;
  moodAnchor: MoodAnchor;
  dominant?: string | null;
  onPicked: (hex: string) => void;
};

const COPY: Record<
  Props["kind"],
  { title: string; subtitle: string; pickerLabel: string }
> = {
  dominant: {
    title: "Pick the dominant color",
    subtitle:
      "The color that fills the most space on every cover. Pick one — or punch in your own.",
    pickerLabel: "Use my own color",
  },
  accent: {
    title: "Pick the accent color",
    subtitle:
      "The high-contrast pop that punctuates the dominant. Pick one — or punch in your own.",
    pickerLabel: "Use my own accent",
  },
};

export function SwatchPickStep({
  kind,
  stepNumber,
  initialHex,
  moodAnchor,
  dominant,
  onPicked,
}: Props) {
  const trpc = useTRPC();
  const [suggestions, setSuggestions] = useState<SwatchSuggestions | null>(null);
  const [selectedHex, setSelectedHex] = useState<string | null>(initialHex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState(initialHex ?? "#");

  const onSuggestSuccess = (data: SwatchSuggestions) => setSuggestions(data);
  const onSuggestError = () =>
    toast.error("Couldn't load color suggestions. Try again.");

  const suggestDominant = useMutation(
    trpc.palette.suggestDominant.mutationOptions({
      onSuccess: onSuggestSuccess,
      onError: onSuggestError,
    })
  );
  const suggestAccent = useMutation(
    trpc.palette.suggestAccent.mutationOptions({
      onSuccess: onSuggestSuccess,
      onError: onSuggestError,
    })
  );

  const setDominant = useMutation(
    trpc.palette.setDominant.mutationOptions({
      onError: () => toast.error("Couldn't save your choice. Try again."),
    })
  );
  const setAccent = useMutation(
    trpc.palette.setAccent.mutationOptions({
      onError: () => toast.error("Couldn't save your choice. Try again."),
    })
  );

  const isSuggestPending =
    kind === "dominant" ? suggestDominant.isPending : suggestAccent.isPending;
  const isSetPending =
    kind === "dominant" ? setDominant.isPending : setAccent.isPending;

  function triggerSuggest() {
    if (kind === "dominant") suggestDominant.mutate({ anchor: moodAnchor });
    else suggestAccent.mutate();
  }

  useEffect(() => {
    if (!suggestions && !isSuggestPending) {
      triggerSuggest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirm() {
    if (!selectedHex) return;
    if (kind === "dominant") {
      setDominant.mutate(
        { hex: selectedHex },
        { onSuccess: () => onPicked(selectedHex) }
      );
    } else {
      setAccent.mutate(
        { hex: selectedHex },
        { onSuccess: () => onPicked(selectedHex) }
      );
    }
  }

  function applyPicker() {
    const trimmed = pickerInput.trim();
    if (!HEX_PATTERN.test(trimmed)) {
      toast.error("Enter a valid 6-digit hex like #1a2b3c");
      return;
    }
    setSelectedHex(trimmed);
    setPickerOpen(false);
  }

  if (isSuggestPending && !suggestions) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="size-7 animate-spin text-violet-300" />
        <p className="text-sm text-zinc-400">Drafting candidates…</p>
      </div>
    );
  }

  const copy = COPY[kind];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <p className="text-center text-xs font-medium uppercase tracking-widest text-violet-400/80">
        Step {stepNumber} / 5
      </p>
      <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight text-white">
        {copy.title}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-zinc-400">
        {copy.subtitle}
      </p>

      <div className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          {moodAnchor.label}
        </span>
        {dominant && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">
              Dominant
            </span>
            <span
              className="size-4 rounded-md border border-white/10"
              style={{ backgroundColor: dominant }}
              aria-label={`Dominant color ${dominant}`}
            />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions?.swatches.map((s: SwatchSuggestion) => (
          <SwatchCard
            key={s.hex}
            swatch={s}
            selected={selectedHex === s.hex}
            onSelect={() => setSelectedHex(s.hex)}
          />
        ))}
      </div>

      {pickerOpen ? (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <span
              className="size-10 shrink-0 rounded-lg border border-white/10"
              style={{
                backgroundColor: HEX_PATTERN.test(pickerInput.trim())
                  ? pickerInput.trim()
                  : "#27272a",
              }}
            />
            <input
              type="text"
              value={pickerInput}
              onChange={(e) => setPickerInput(e.target.value)}
              placeholder="#1a2b3c"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none"
            />
            <Button size="sm" onClick={applyPicker}>
              <Check className="size-3.5" />
              Use
            </Button>
            <Button
              variant="ghost-secondary"
              size="sm"
              onClick={() => setPickerOpen(false)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            6-digit hex. Lowercase or uppercase, both fine.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex justify-center">
          <Button
            variant="ghost-secondary"
            size="sm"
            onClick={() => setPickerOpen(true)}
          >
            <Pipette className="size-3.5" />
            {copy.pickerLabel}
          </Button>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost-secondary"
          size="sm"
          onClick={triggerSuggest}
          disabled={isSuggestPending}
        >
          Suggest others
        </Button>
        <Button onClick={handleConfirm} disabled={!selectedHex || isSetPending}>
          {isSetPending && <Loader2 className="size-3.5 animate-spin" />}
          Continue
        </Button>
      </div>
    </motion.div>
  );
}
