"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { Direction } from "@/lib/schemas/direction";

interface DirectionExpandedProps {
  direction: Direction;
  onSelect: (e: React.MouseEvent) => void;
  isSelectPending: boolean;
}

export function DirectionExpanded({
  direction,
  onSelect,
  isSelectPending,
}: DirectionExpandedProps) {
  return (
    <div className="bg-[var(--background-elevated)] p-[var(--space-6)]">
      {/* Supporting images */}
      {direction.supportingImageUrls.length > 0 && (
        <div className="flex gap-[var(--space-3)] overflow-x-auto">
          {direction.supportingImageUrls.map((url, i) => (
            <div
              key={i}
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-md)] lg:h-32 lg:w-32"
            >
              <Image
                src={url}
                alt={`${direction.moodLabel} supporting image ${i + 1}`}
                fill
                className="object-cover"
                sizes="128px"
              />
            </div>
          ))}
        </div>
      )}

      {/* Color palette */}
      <div className="mt-[var(--space-4)] flex gap-[var(--space-2)]">
        {direction.colorPalette.map((color) => (
          <div
            key={color}
            className="h-6 w-6 rounded-[var(--radius-full)]"
            style={{ backgroundColor: color }}
            aria-label={`Palette color ${color}`}
          />
        ))}
      </div>

      {/* Description */}
      <p className="mt-[var(--space-4)] text-sm leading-relaxed text-[var(--foreground-muted)]">
        {direction.description}
      </p>

      {/* CTA */}
      <Button
        variant="primary"
        className="mt-[var(--space-6)] w-full"
        onClick={onSelect}
        disabled={isSelectPending}
      >
        {isSelectPending ? "Selecting..." : "Choose this direction"}
      </Button>
    </div>
  );
}
