"use client";

import { useState } from "react";
import { useTRPC, trpcClient } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Loader2, Sun, Moon, Flame, Snowflake, Sparkles, CloudFog } from "lucide-react";
import type { MoodboardSpec, PaletteNudge } from "@/lib/schemas/moodboard";

const NUDGE_PAIRS: Array<{
  label: string;
  left: { nudge: PaletteNudge; icon: typeof Sun; label: string };
  right: { nudge: PaletteNudge; icon: typeof Sun; label: string };
}> = [
  {
    label: "Brightness",
    left: { nudge: "darker", icon: Moon, label: "Darker" },
    right: { nudge: "lighter", icon: Sun, label: "Lighter" },
  },
  {
    label: "Temperature",
    left: { nudge: "cooler", icon: Snowflake, label: "Cooler" },
    right: { nudge: "warmer", icon: Flame, label: "Warmer" },
  },
  {
    label: "Saturation",
    left: { nudge: "more_muted", icon: CloudFog, label: "More muted" },
    right: { nudge: "more_vibrant", icon: Sparkles, label: "More vibrant" },
  },
];

export function MoodboardRefinement({
  moodboardId,
  initialSpec,
  onComplete,
}: {
  moodboardId: string;
  initialSpec: MoodboardSpec;
  onComplete: () => void;
}) {
  const trpc = useTRPC();
  const [spec, setSpec] = useState<MoodboardSpec>(initialSpec);
  const [disabledTags, setDisabledTags] = useState<Set<string>>(new Set());
  const [isNudging, setIsNudging] = useState(false);

  const completeMutation = useMutation(
    trpc.moodboard.complete.mutationOptions({
      onSuccess: () => {
        onComplete();
      },
    })
  );

  async function applyNudge(nudge: PaletteNudge) {
    if (isNudging) return;
    setIsNudging(true);
    try {
      const result = await trpcClient.moodboard.nudgePalette.query({
        palette: spec.palette,
        nudge,
      });
      setSpec((prev) => ({ ...prev, palette: result.palette }));
    } catch {
      toast.error("Failed to adjust palette");
    } finally {
      setIsNudging(false);
    }
  }

  function toggleTag(tag: string) {
    setDisabledTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        // Don't allow disabling all tags
        if (spec.tags.length - next.size <= 1) return prev;
        next.add(tag);
      }
      return next;
    });
  }

  function handleSave() {
    const finalSpec: MoodboardSpec = {
      ...spec,
      tags: spec.tags.filter((t) => !disabledTags.has(t)),
    };
    completeMutation.mutate({ moodboardId, spec: finalSpec });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex w-full max-w-2xl flex-col gap-8"
    >
      {/* Creative direction narrative — front and center */}
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">
          Your creative direction
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Synthesized from your liked directions and audio profile.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-sm font-medium text-zinc-300">
          {spec.coreIdea}
        </p>
        <p className="mt-1 text-xs text-zinc-500 italic">
          {spec.duality}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          {spec.narrative}
        </p>
      </div>

      {/* Palette swatches */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Palette</h3>
        <div className="flex gap-2">
          {spec.palette.map((hex, i) => (
            <div
              key={i}
              className="size-10 rounded-lg border border-zinc-700/50 transition-colors"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
        </div>

        {/* Nudge controls */}
        <p className="mt-4 mb-3 text-xs text-zinc-600">
          Already pre-set from your audio profile. Adjust only if it feels off.
        </p>
        <div className="flex flex-col gap-2">
          {NUDGE_PAIRS.map(({ label, left, right }) => (
            <div key={label} className="flex items-center gap-2">
              <button
                onClick={() => applyNudge(left.nudge)}
                disabled={isNudging}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
              >
                <left.icon className="size-3.5" />
                {left.label}
              </button>
              <span className="flex-1 text-center text-[10px] text-zinc-600 uppercase tracking-wider">
                {label}
              </span>
              <button
                onClick={() => applyNudge(right.nudge)}
                disabled={isNudging}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-300 disabled:opacity-50"
              >
                <right.icon className="size-3.5" />
                {right.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Vibe tags</h3>
        <div className="flex flex-wrap gap-2">
          {spec.tags.map((tag) => {
            const isDisabled = disabledTags.has(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  isDisabled
                    ? "bg-white/5 text-zinc-600 line-through"
                    : "bg-white/10 text-zinc-300"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual world details (read-only) */}
      <div className="grid grid-cols-2 gap-4 text-xs text-zinc-500">
        <div>
          <span className="font-medium text-zinc-400">Textures:</span>{" "}
          {spec.textures.join(", ")}
        </div>
        <div>
          <span className="font-medium text-zinc-400">Environment:</span>{" "}
          {spec.environment.join(", ")}
        </div>
        <div>
          <span className="font-medium text-zinc-400">Styling:</span>{" "}
          {spec.styling.join(", ")}
        </div>
        <div>
          <span className="font-medium text-zinc-400">Lighting:</span>{" "}
          {spec.lighting}
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <motion.button
          onClick={handleSave}
          disabled={completeMutation.isPending}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-zinc-900 disabled:opacity-50"
        >
          {completeMutation.isPending && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Looks right — save it
        </motion.button>
      </div>
    </motion.div>
  );
}
