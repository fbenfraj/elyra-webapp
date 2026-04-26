"use client";

import { useRouter } from "next/navigation";
import { Palette, RefreshCw } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MoodboardSpecSummary } from "@/features/moodboard/components/MoodboardSpecSummary";

export function MoodboardIdentitySettings() {
  const trpc = useTRPC();
  const router = useRouter();

  const { data: moodboard, isLoading } = useQuery(
    trpc.moodboard.active.queryOptions()
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-900 p-6 space-y-5">
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-48 animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
          <div className="h-12 w-full animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="size-7 animate-pulse rounded-lg bg-zinc-800"
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-5 w-14 animate-pulse rounded-full bg-zinc-800"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!moodboard) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700/50 bg-zinc-900/50 p-6 space-y-5">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-violet-950/50 ring-1 ring-violet-800/40">
            <Palette className="size-5 text-violet-400" />
          </div>
          <div className="text-center">
            <h2 className="text-base font-semibold text-zinc-100">
              Visual Identity
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              No visual identity set yet
            </p>
          </div>
          <Button
            variant="ghost-secondary"
            size="sm"
            onClick={() => router.push("/onboarding/moodboard")}
          >
            <Palette className="size-3.5" />
            Create moodboard
          </Button>
        </div>
      </div>
    );
  }

  const spec = moodboard.spec;

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900 p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            Visual Identity
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Your moodboard shapes the style of every generation
          </p>
        </div>
        <Button
          variant="ghost-secondary"
          size="sm"
          onClick={() => router.push("/onboarding/moodboard")}
        >
          <RefreshCw className="size-3.5" />
          Redo
        </Button>
      </div>

      {spec && <MoodboardSpecSummary spec={spec} />}

      {moodboard.anchors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Style anchors
          </p>
          <div className="flex gap-2">
            {moodboard.anchors.map((anchor) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={anchor.imageKey}
                src={anchor.imageUrl}
                alt="Anchor"
                width={80}
                height={80}
                className="size-20 rounded-lg object-cover"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
