"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Direction } from "@/lib/schemas/direction";
import { BriefDisplay } from "./BriefDisplay";
import { DirectionCard, DirectionCardSkeleton } from "./DirectionCard";

interface DirectionGridProps {
  directions: Direction[];
  briefText: string;
  selectedDirectionId: string | null;
  onSelect: (directionId: string) => void;
  isSelectPending: boolean;
  onRecovery?: () => void;
}

export function DirectionGrid({
  directions,
  briefText,
  selectedDirectionId,
  onSelect,
  isSelectPending,
  onRecovery,
}: DirectionGridProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [visibleCards, setVisibleCards] = useState<boolean[]>(() =>
    prefersReducedMotion ? directions.map(() => true) : []
  );
  const [mobileIndex, setMobileIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Staggered fade-in on mount (skip if reduced motion)
  useEffect(() => {
    if (prefersReducedMotion) return;
    const timers: NodeJS.Timeout[] = [];
    directions.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleCards((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, i * 100)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [directions, prefersReducedMotion]);

  const handleToggleExpand = useCallback(
    (index: number) => {
      setExpandedIndex((prev) => (prev === index ? null : index));
    },
    []
  );

  // Mobile swipe handling via scroll snap
  const handleScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.clientWidth;
    const newIndex = Math.round(scrollLeft / cardWidth);
    setMobileIndex(Math.max(0, Math.min(newIndex, directions.length - 1)));
  }, [directions.length]);

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col items-center justify-center py-8">
      {/* Brief text */}
      <div className="w-full max-w-[var(--content-wide)] px-0">
        <BriefDisplay text={briefText} />
      </div>

      {/* Direction cards - Desktop grid */}
      <div
        role="radiogroup"
        aria-label="Creative directions"
        className="mt-[var(--space-8)] hidden w-full max-w-[var(--content-wide)] gap-[var(--space-4)] md:grid md:grid-cols-3"
      >
        {directions.map((direction, i) => (
          <div
            key={direction.id}
            style={{
              opacity: visibleCards[i] ? 1 : 0,
              transform: visibleCards[i]
                ? "translateY(0)"
                : "translateY(10px)",
              transition: prefersReducedMotion
                ? "none"
                : `opacity var(--duration-normal) var(--ease-enter), transform var(--duration-normal) var(--ease-enter)`,
            }}
          >
            <DirectionCard
              direction={direction}
              index={i}
              isExpanded={expandedIndex === i}
              isSelected={selectedDirectionId === direction.id}
              isDimmed={selectedDirectionId !== null && selectedDirectionId !== direction.id}
              onToggleExpand={() => handleToggleExpand(i)}
              onSelect={() => onSelect(direction.id)}
              isSelectPending={isSelectPending}
            />
          </div>
        ))}
      </div>

      {/* Direction cards - Mobile carousel */}
      <div className="mt-[var(--space-8)] w-full md:hidden">
        <div
          ref={carouselRef}
          role="radiogroup"
          aria-label="Creative directions"
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
          onScroll={handleScroll}
          style={{ scrollbarWidth: "none" }}
        >
          {directions.map((direction, i) => (
            <div
              key={direction.id}
              className="w-full shrink-0 snap-center px-[var(--space-4)]"
              style={{
                opacity: visibleCards[i] ? 1 : 0,
                transform: visibleCards[i]
                  ? "translateY(0)"
                  : "translateY(10px)",
                transition: prefersReducedMotion
                  ? "none"
                  : `opacity var(--duration-normal) var(--ease-enter), transform var(--duration-normal) var(--ease-enter)`,
              }}
            >
              <DirectionCard
                direction={direction}
                index={i}
                isExpanded={expandedIndex === i}
                isSelected={selectedDirectionId === direction.id}
                isDimmed={selectedDirectionId !== null && selectedDirectionId !== direction.id}
                onToggleExpand={() => handleToggleExpand(i)}
                onSelect={() => onSelect(direction.id)}
                isSelectPending={isSelectPending}
              />
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        <div className="mt-[var(--space-4)] flex justify-center gap-[var(--space-2)]">
          {directions.map((_, i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-[var(--radius-full)] transition-colors"
              style={{
                backgroundColor:
                  i === mobileIndex
                    ? "var(--foreground)"
                    : "var(--foreground-subtle)",
                transitionDuration: "var(--duration-fast)",
              }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* "None of these" recovery action */}
      {onRecovery && selectedDirectionId === null && (
        <button
          type="button"
          onClick={onRecovery}
          className="mb-12 mt-[var(--space-8)] text-sm font-normal text-[var(--foreground-muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
        >
          None of these -- try a different angle
        </button>
      )}
    </div>
  );
}

export function DirectionGridSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col items-center justify-center">
      <div className="w-full max-w-[var(--content-wide)]">
        <div className="h-4 w-48 animate-pulse rounded bg-[var(--background-overlay)]" />
        <div className="mt-2 h-5 w-80 animate-pulse rounded bg-[var(--background-overlay)]" />
      </div>
      <div className="mt-[var(--space-8)] hidden w-full max-w-[var(--content-wide)] gap-[var(--space-4)] md:grid md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <DirectionCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-[var(--space-8)] w-full md:hidden">
        <DirectionCardSkeleton />
      </div>
    </div>
  );
}
