"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreativeProcessLoader } from "@/features/generation/components/CreativeProcessLoader";
import { Heart } from "lucide-react";
import { trpcClient } from "@/lib/trpc/client";

type CuratedImage = {
  id: string;
  imageUrl: string;
  batchNumber: number;
};

interface ImageSelectionProps {
  sessionId: string;
  briefText: string;
  images: CuratedImage[];
  canRegenerate: boolean;
  regenCount: number;
  maxRegens: number;
  isRegenerating: boolean;
  onRegenerate: () => void;
  onConfirm: () => void;
  isConfirmPending: boolean;
}

export function ImageSelection({
  sessionId,
  briefText,
  images,
  canRegenerate,
  regenCount,
  maxRegens,
  isRegenerating,
  onRegenerate,
  onConfirm,
  isConfirmPending,
}: ImageSelectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // Both of these used to be plain state written from an effect, which cost a
  // second render pass every time the server answered. They are derived now:
  // `selectedId` falls back to the highest-scoring image (the ranked list is
  // ordered), and `likedIds` shows the optimistic override only while a like is
  // in flight, the server's answer the rest of the time.
  const [selectionOverride, setSelectedId] = useState<string | null>(null);
  const [likeOverride, setLikedIds] = useState<Set<string> | null>(null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const selectionRowRef = useRef<HTMLDivElement>(null);
  const focusIndexRef = useRef(0);

  // Fetch initial liked state
  const likesQuery = useQuery(
    trpc.feedback.getLikes.queryOptions({ sessionId })
  );

  const selectedId = selectionOverride ?? images[0]?.id ?? null;
  const likedIds = likeOverride ?? new Set(likesQuery.data ?? []);

  // Like mutation with optimistic update
  const likeMutation = useMutation(
    trpc.feedback.like.mutationOptions({
      onMutate: async ({ generationAttemptId }) => {
        const previousLikedIds = new Set(likedIds);
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (next.has(generationAttemptId)) {
            next.delete(generationAttemptId);
          } else {
            next.add(generationAttemptId);
          }
          return next;
        });
        // Trigger scale animation
        setAnimatingId(generationAttemptId);
        setTimeout(() => setAnimatingId(null), 200);
        return { previousLikedIds };
      },
      onError: (_err, _vars, context) => {
        if (context?.previousLikedIds) {
          setLikedIds(context.previousLikedIds);
        }
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.feedback.getLikes.queryKey({ sessionId }),
        });
        setLikedIds(null);
      },
    })
  );

  const handleLike = useCallback(
    (e: React.MouseEvent, attemptId: string) => {
      e.stopPropagation();
      likeMutation.mutate({ sessionId, generationAttemptId: attemptId });
    },
    [sessionId, likeMutation]
  );

  const selectImageMutation = useMutation(
    trpc.generation.selectImage.mutationOptions({
      onSuccess: () => {
        // Selection stored in DB -- no optimistic UI needed
      },
    })
  );

  // The default selection is already visible through `selectedId` above; this
  // only tells the server about it. It sits below the mutation because reading
  // `selectImageMutation` above its own declaration is a temporal dead zone.
  const defaultPersisted = useRef(false);
  useEffect(() => {
    if (selectionOverride === null && images.length > 0 && !defaultPersisted.current) {
      defaultPersisted.current = true;
      selectImageMutation.mutate({ sessionId, attemptId: images[0]!.id });
    }
  }, [images, sessionId, selectionOverride, selectImageMutation]);

  const handleSelect = useCallback(
    (attemptId: string) => {
      const previousId = selectedId;
      if (previousId && previousId !== attemptId) {
        void trpcClient.feedback.captureEvent.mutate({
          sessionId,
          action: "image_deselected",
          payload: { attemptId: previousId },
        });
      }
      void trpcClient.feedback.captureEvent.mutate({
        sessionId,
        action: "image_selected",
        payload: { attemptId },
      });
      setSelectedId(attemptId);
      selectImageMutation.mutate({ sessionId, attemptId });
    },
    [sessionId, selectImageMutation, selectedId]
  );

  // Keyboard navigation for selection row
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (images.length === 0) return;

      let newIndex = focusIndexRef.current;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        newIndex = Math.min(newIndex + 1, images.length - 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        newIndex = Math.max(newIndex - 1, 0);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const img = images[focusIndexRef.current];
        if (img) {
          handleSelect(img.id);
        }
        return;
      } else {
        return;
      }

      focusIndexRef.current = newIndex;
      const buttons = selectionRowRef.current?.querySelectorAll(
        "[data-image-thumb]"
      );
      const target = buttons?.[newIndex] as HTMLElement | undefined;
      target?.focus();
    },
    [images, handleSelect]
  );

  const selectedImage = images.find((img) => img.id === selectedId);
  const hasMultipleBatches =
    new Set(images.map((img) => img.batchNumber)).size > 1;

  return (
    <div
      className="flex min-h-[calc(100dvh-48px)] flex-col items-center px-[var(--space-4)] pt-[var(--space-8)]"
      style={{
        animation:
          "fadeIn var(--duration-normal, 200ms) var(--ease-enter, ease-out)",
      }}
    >
      {/* Brief reminder */}
      <p className="text-sm text-[var(--foreground-muted)]">{briefText}</p>

      {/* Hero area */}
      <div className="relative mt-[var(--space-6)] w-full max-w-[400px]">
        {selectedImage ? (
          <img
            src={selectedImage.imageUrl}
            alt="Selected cover art"
            className="aspect-square w-full rounded-[var(--radius-md)] object-cover"
            style={{
              opacity: isRegenerating ? 0.4 : 1,
              transition: "opacity var(--duration-normal, 200ms)",
            }}
          />
        ) : (
          <div className="aspect-square w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--background-overlay)]" />
        )}

        {/* Regeneration overlay */}
        {isRegenerating && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-md)]">
            <CreativeProcessLoader briefText={briefText} />
          </div>
        )}
      </div>

      {/* Multi-batch label */}
      {hasMultipleBatches && !isRegenerating && (
        <p className="mt-[var(--space-4)] text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
          Your strongest options
        </p>
      )}

      {/* Selection row */}
      <div
        ref={selectionRowRef}
        role="radiogroup"
        aria-label="Image selection"
        className="mt-[var(--space-4)] flex w-full max-w-[600px] gap-[var(--space-3)] overflow-x-auto pb-[var(--space-2)]"
        style={{ scrollbarWidth: "thin" }}
        onKeyDown={handleKeyDown}
      >
        {images.map((img, index) => {
          const isSelected = img.id === selectedId;
          const isLiked = likedIds.has(img.id);
          const isAnimating = animatingId === img.id;
          return (
            <button
              key={img.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Image ${index + 1}${isSelected ? " (selected)" : ""}`}
              data-image-thumb
              onClick={() => handleSelect(img.id)}
              onFocus={() => {
                focusIndexRef.current = index;
              }}
              className="relative shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{
                borderRadius: "var(--radius-sm)",
                overflow: "hidden",
              }}
            >
              <img
                src={img.imageUrl}
                alt={`Option ${index + 1}`}
                className="h-16 w-16 object-cover md:h-20 md:w-20"
                style={{
                  opacity: isSelected ? 1 : 0.6,
                  outline: isSelected ? "2px solid var(--accent)" : "none",
                  outlineOffset: "-2px",
                  borderRadius: "var(--radius-sm)",
                  transition:
                    "opacity var(--duration-fast, 100ms), outline var(--duration-fast, 100ms)",
                }}
              />
              <span
                role="button"
                tabIndex={-1}
                aria-label={isLiked ? "Unlike this image" : "Like this image"}
                onClick={(e) => handleLike(e, img.id)}
                className="absolute bottom-0 right-0 flex h-[44px] w-[44px] items-center justify-center"
                style={{ cursor: "pointer" }}
              >
                <Heart
                  size={16}
                  fill={isLiked ? "currentColor" : "none"}
                  className={isLiked ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"}
                  style={{
                    transition: "transform 200ms ease, color 200ms ease",
                    transform: isAnimating ? "scale(1.2)" : "scale(1)",
                    filter: isLiked ? "none" : "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-[var(--space-6)] flex flex-col items-center gap-[var(--space-3)]">
        {/* Confirm selection button */}
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedId || isConfirmPending || isRegenerating}
          className="rounded-[var(--radius-md)] bg-[var(--accent)] px-[var(--space-6)] py-[var(--space-3)] text-sm font-medium text-[var(--background)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isConfirmPending ? "Confirming..." : "Use this image"}
        </button>

        {/* Regenerate button */}
        {canRegenerate && !isRegenerating && (
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-[var(--radius-md)] border border-[var(--foreground-subtle)] bg-transparent px-[var(--space-6)] py-[var(--space-3)] text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            Regenerate
          </button>
        )}

        {/* Regen limit message */}
        {!canRegenerate && !isRegenerating && regenCount >= maxRegens && (
          <p className="text-xs text-[var(--foreground-subtle)]">
            These are your strongest options
          </p>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
