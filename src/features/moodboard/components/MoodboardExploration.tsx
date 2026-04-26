"use client";

import { useState, useRef, useEffect } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { MoodboardDirectionCard } from "@/features/moodboard/components/MoodboardDirectionCard";
import { MOODBOARD_DIRECTION_COUNT } from "@/config/moodboard-client";
import type { DirectionWithUrl } from "@/lib/schemas/moodboard";

export function MoodboardExploration({
  moodboardId,
  directions,
  likedDirectionIds,
  onStartRefinement,
}: {
  moodboardId: string;
  directions: DirectionWithUrl[];
  likedDirectionIds: string[];
  onStartRefinement: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localLikedIds, setLocalLikedIds] = useState<string[]>(likedDirectionIds);

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  function patchLikedIds(likedDirectionIds: string[]) {
    setLocalLikedIds(likedDirectionIds);
    queryClient.setQueryData(
      trpc.moodboard.getById.queryKey({ id: moodboardId }),
      (old) => old ? { ...old, likedDirectionIds } : old
    );
  }

  const likeMutation = useMutation(
    trpc.moodboard.likeDirection.mutationOptions({
      onSuccess: (data) => {
        patchLikedIds(data.likedDirectionIds);
      },
    })
  );

  const unlikeMutation = useMutation(
    trpc.moodboard.unlikeDirection.mutationOptions({
      onSuccess: (data) => {
        patchLikedIds(data.likedDirectionIds);
      },
    })
  );

  const currentDirection = directions[currentIndex];
  const isLiked = currentDirection ? localLikedIds.includes(currentDirection.id) : false;
  const isLastDirection = currentIndex === directions.length - 1;
  const likedCount = localLikedIds.length;
  const isPending = likeMutation.isPending || unlikeMutation.isPending;

  function handleLikeAndAdvance() {
    if (!currentDirection) return;

    if (isLiked) {
      unlikeMutation.mutate({ moodboardId, directionId: currentDirection.id });
    } else {
      likeMutation.mutate(
        { moodboardId, directionId: currentDirection.id },
        {
          onSuccess: () => {
            if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
            advanceTimerRef.current = setTimeout(() => setCurrentIndex((i) => i + 1), 400);
          },
        }
      );
    }
  }

  // Recap screen after all 6
  if (currentIndex >= directions.length) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-xl font-semibold text-zinc-100">
          {likedCount === 0 ? "No directions liked" : `${likedCount} direction${likedCount !== 1 ? "s" : ""} liked`}
        </h2>
        {likedCount === 0 ? (
          <p className="text-sm text-zinc-400">
            Go back and like at least one direction to continue.
          </p>
        ) : (
          <p className="text-sm text-zinc-400">
            Ready to build your visual identity from your selections.
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentIndex(0)}
            className="rounded-full bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10"
          >
            Review again
          </button>
          {likedCount > 0 && (
            <motion.button
              onClick={onStartRefinement}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-900"
            >
              Continue
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  if (!currentDirection) return null;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Progress bar */}
      <div className="flex w-full max-w-2xl gap-1.5">
        {Array.from({ length: MOODBOARD_DIRECTION_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < currentIndex
                ? "bg-white/40"
                : i === currentIndex
                  ? "bg-white"
                  : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Direction card */}
      <AnimatePresence mode="wait">
        <MoodboardDirectionCard
          key={currentDirection.id}
          direction={currentDirection}
          isLiked={isLiked}
          onLike={handleLikeAndAdvance}
          onSkip={() => {
            if (isLastDirection) {
              setCurrentIndex(directions.length); // Go to recap
            } else {
              setCurrentIndex((i) => i + 1);
            }
          }}
          isPending={isPending}
        />
      </AnimatePresence>

      {/* Liked count */}
      <p className="text-sm text-zinc-500">
        {likedCount > 0
          ? `${likedCount} liked so far`
          : `${currentIndex + 1} of ${directions.length}`}
      </p>
    </div>
  );
}
