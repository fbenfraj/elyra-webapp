"use client";

import { useEffect, useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MOODBOARD_POLL_INTERVAL_MS } from "@/config/moodboard-client";
import type { MoodboardSpec } from "@/lib/schemas/moodboard";
import { MoodboardIntro } from "@/features/moodboard/components/MoodboardIntro";
import { MoodboardExploration } from "@/features/moodboard/components/MoodboardExploration";
import { MoodboardRefinement } from "@/features/moodboard/components/MoodboardRefinement";
import { MoodboardCompletion } from "@/features/moodboard/components/MoodboardCompletion";
import { Loader2 } from "lucide-react";

export function MoodboardFlow() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [moodboardId, setMoodboardId] = useState<string | null>(null);
  const [refinementSpec, setRefinementSpec] = useState<MoodboardSpec | null>(null);
  const hasCreatedRef = useRef(false);

  const { data: userSettings } = useQuery(
    trpc.user.settings.queryOptions()
  );

  const createMoodboard = useMutation(
    trpc.moodboard.create.mutationOptions({
      onSuccess: (data) => {
        setMoodboardId(data.moodboardId);
      },
    })
  );

  const startRefinement = useMutation(
    trpc.moodboard.startRefinement.mutationOptions({
      onSuccess: (spec) => {
        setRefinementSpec(spec);
      },
    })
  );

  useEffect(() => {
    if (hasCreatedRef.current) return;
    hasCreatedRef.current = true;
    createMoodboard.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: moodboard } = useQuery(
    trpc.moodboard.getById.queryOptions(
      { id: moodboardId! },
      {
        enabled: !!moodboardId,
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (!status || status === "generating") return MOODBOARD_POLL_INTERVAL_MS;
          return false;
        },
      }
    )
  );

  const status = moodboard?.status ?? "generating";

  // Determine content based on status
  let content: React.ReactNode = null;

  if (startRefinement.isPending) {
    content = (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="size-8 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-400">Synthesizing your visual identity...</p>
      </div>
    );
  } else if ((startRefinement.isSuccess || status === "refining") && refinementSpec) {
    content = (
      <MoodboardRefinement
        moodboardId={moodboard!.id}
        initialSpec={refinementSpec}
        onComplete={() => {
          setRefinementSpec(null);
          startRefinement.reset();
          queryClient.invalidateQueries({
            queryKey: trpc.moodboard.getById.queryKey({ id: moodboard!.id }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.moodboard.active.queryKey(),
          });
        }}
      />
    );
  } else if (status === "generating" || status === "failed") {
    content = (
      <MoodboardIntro
        artistName={userSettings?.artistName ?? null}
        artistGenres={userSettings?.artistGenres ?? null}
        failed={status === "failed"}
        onRetry={() => {
          setMoodboardId(null);
          setRefinementSpec(null);
          createMoodboard.mutate();
        }}
      />
    );
  } else if (status === "exploring" && moodboard) {
    content = (
      <MoodboardExploration
        moodboardId={moodboard.id}
        directions={moodboard.directionsWithUrls}
        likedDirectionIds={moodboard.likedDirectionIds}
        onStartRefinement={() => {
          startRefinement.mutate({ moodboardId: moodboard.id });
        }}
      />
    );
  } else if (status === "complete" && moodboard?.spec) {
    content = <MoodboardCompletion spec={moodboard.spec} />;
  }

  return (
    <div className="flex w-full flex-col items-center">
      {content}
    </div>
  );
}
