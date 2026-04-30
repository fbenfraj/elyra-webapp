"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "motion/react";
import { Music2, ArrowRight } from "lucide-react";
import { AnimatedDashboardItem } from "@/features/session/components/DashboardAnimations";
import type { MoodboardSpec } from "@/lib/schemas/moodboard";

const GRADIENT_POSITIONS = [
  { x: 10, y: 15 },
  { x: 85, y: 10 },
  { x: 50, y: 80 },
  { x: 20, y: 60 },
  { x: 75, y: 65 },
];

function PaletteGradientBackground({ palette }: { palette: string[] }) {
  const stops = palette.map((hex, i) => {
    const pos = GRADIENT_POSITIONS[i % GRADIENT_POSITIONS.length];
    return `radial-gradient(ellipse at ${pos.x}% ${pos.y}%, ${hex}18 0%, transparent 55%)`;
  });

  return (
    <motion.div
      className="absolute inset-0 -z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: [
            ...stops,
            "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
          ].join(", "),
        }}
      />
      <div className="absolute inset-0 bg-[#09090b]/40" />
    </motion.div>
  );
}

export function MoodboardIdentityHero({
  artistName,
  artistImageUrl,
  artistGenres,
  sessionCount,
  spec,
}: {
  artistName: string;
  artistImageUrl: string | null;
  artistGenres: string[] | null;
  sessionCount: number;
  spec: MoodboardSpec;
}) {
  const router = useRouter();

  return (
    <AnimatedDashboardItem>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        <PaletteGradientBackground palette={spec.palette} />

        <div className="px-8 py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              {artistImageUrl ? (
                <div className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-white/10 shadow-2xl">
                  <Image
                    src={artistImageUrl}
                    alt={artistName}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-white/10 bg-white/5">
                  <Music2 className="size-7 text-[var(--foreground-subtle)]" />
                </div>
              )}

              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {artistName}
                </h1>
                {artistGenres && artistGenres.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {artistGenres.slice(0, 3).map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs text-[var(--foreground-muted)]"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-sm text-[var(--foreground-subtle)]">
                  {sessionCount} release{sessionCount !== 1 ? "s" : ""} created
                </p>
              </div>
            </div>

            <motion.button
              onClick={() => router.push("/dashboard/moodboard")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 rounded-full bg-white/8 px-3.5 py-1.5 text-xs font-medium text-[var(--foreground-muted)] backdrop-blur-sm transition-colors hover:bg-white/12 hover:text-[var(--foreground)]"
            >
              Go to moodboard
              <ArrowRight className="size-3" />
            </motion.button>
          </div>

          <div className="my-5 h-px bg-white/6" />

          <div className="flex items-end justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-zinc-200">
                {spec.coreIdea}
              </p>
              <p className="mt-1 text-xs italic text-zinc-500">
                {spec.duality}
              </p>
            </div>

            <div className="flex shrink-0 gap-1.5">
              {spec.palette.map((hex, i) => (
                <div
                  key={i}
                  className="size-6 rounded-md border border-white/10 shadow-sm"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          {spec.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {spec.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </AnimatedDashboardItem>
  );
}
