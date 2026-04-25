"use client";

import { Button } from "@/components/ui/button";
import { Star, Calendar, FolderOpen } from "lucide-react";

type FilterState = {
  sessionId?: string;
  favoritedOnly: boolean;
  since: "7d" | "30d" | "all";
};

type Props = {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  sessions: { id: string; briefText: string }[];
};

export function LibraryFilters({ filters, onFilterChange, sessions }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date range */}
      <div className="flex items-center gap-1 rounded-lg bg-background-elevated p-1">
        <Calendar className="ml-2 size-4 text-foreground-subtle" />
        {(["7d", "30d", "all"] as const).map((range) => (
          <Button
            key={range}
            variant={filters.since === range ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onFilterChange({ ...filters, since: range })}
            className="h-7 px-2.5 text-xs"
          >
            {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "All time"}
          </Button>
        ))}
      </div>

      {/* Favorites toggle */}
      <Button
        variant={filters.favoritedOnly ? "secondary" : "ghost"}
        size="sm"
        onClick={() =>
          onFilterChange({ ...filters, favoritedOnly: !filters.favoritedOnly })
        }
        className="h-8 gap-1.5"
      >
        <Star
          className={`size-4 ${filters.favoritedOnly ? "fill-current" : ""}`}
        />
        Favorites
      </Button>

      {/* Session filter */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-1.5">
          <FolderOpen className="size-4 text-foreground-subtle" />
          <select
            value={filters.sessionId ?? ""}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                sessionId: e.target.value || undefined,
              })
            }
            className="h-8 rounded-md border border-border bg-background-elevated px-2 text-xs text-foreground"
          >
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.briefText.slice(0, 40)}
                {s.briefText.length > 40 ? "..." : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
