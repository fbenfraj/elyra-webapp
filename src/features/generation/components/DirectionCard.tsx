"use client";

import { forwardRef } from "react";
import Image from "next/image";
import type { Direction } from "@/lib/schemas/direction";
import { DirectionExpanded } from "./DirectionExpanded";

interface DirectionCardProps {
  direction: Direction;
  index: number;
  isExpanded: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  isSelectPending: boolean;
}

export const DirectionCard = forwardRef<HTMLDivElement, DirectionCardProps>(
  function DirectionCard(
    {
      direction,
      index,
      isExpanded,
      isSelected,
      isDimmed,
      onToggleExpand,
      onSelect,
      isSelectPending,
    },
    ref
  ) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggleExpand();
      }
      if (e.key === "Escape" && isExpanded) {
        e.preventDefault();
        onToggleExpand();
      }
    };

    return (
      <div
        ref={ref}
        role="radio"
        aria-checked={isSelected}
        aria-label={`${direction.moodLabel} direction -- ${direction.tags.join(", ")}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={onToggleExpand}
        data-expanded={isExpanded || undefined}
        data-selected={isSelected || undefined}
        data-dimmed={isDimmed || undefined}
        className="direction-card group relative flex cursor-pointer flex-col overflow-hidden rounded-[var(--radius-md)] outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--ring)] data-[selected]:ring-2 data-[selected]:ring-[var(--accent)] lg:hover:scale-[1.02] lg:hover:border lg:hover:border-[var(--accent)]"
        style={{
          opacity: isDimmed ? 0.6 : 1,
          transform: isDimmed ? "scale(0.98)" : undefined,
          transitionDuration: "var(--duration-fast)",
          transitionTimingFunction: "var(--ease-default)",
        }}
      >
        {/* Hero image */}
        <div className="relative h-[60dvh] w-full md:h-[300px] lg:h-[420px]">
          <Image
            src={direction.heroImageUrl}
            alt={`${direction.moodLabel} direction -- ${direction.tags.join(", ")}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
            priority={index === 0}
          />

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 60%, rgba(9,9,11,0.85) 100%)",
            }}
          />

          {/* Mood label + tags over gradient */}
          <div className="absolute bottom-0 left-0 right-0 p-[var(--space-6)]">
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
              {direction.moodLabel}
            </h3>
            <div className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-2)]">
              {direction.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[var(--radius-full)] bg-[var(--background-overlay)] px-[var(--space-3)] py-[var(--space-1)] text-xs font-medium tracking-[0.02em] text-[var(--foreground-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Expanded section */}
        {isExpanded && (
          <DirectionExpanded
            direction={direction}
            onSelect={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            isSelectPending={isSelectPending}
          />
        )}
      </div>
    );
  }
);

export function DirectionCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[var(--radius-md)]">
      <div className="h-[60dvh] w-full bg-[var(--background-overlay)] md:h-[300px] lg:h-[420px]" />
    </div>
  );
}
