"use client";

import { useRouter } from "next/navigation";

function formatRelativeDate(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  interpreting: "Interpreting brief",
  generating_directions: "Generating directions",
  selecting: "Selecting direction",
  direction_selected: "Direction chosen",
  evaluating: "Evaluating",
  packaging: "Packaging",
  delivered: "Ready to download",
  complete: "Completed",
  failed: "Failed",
};

type SessionCardProps = {
  id: string;
  briefText: string;
  status: string;
  createdAt: Date;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

export function SessionCard({
  id,
  briefText,
  status,
  createdAt,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
}: SessionCardProps) {
  const router = useRouter();
  const isFailed = status === "failed";
  const isComplete = status === "complete" || status === "delivered" || status === "direction_selected";

  return (
    <button
      type="button"
      onClick={() => {
        if (selectMode) {
          onToggleSelect?.();
        } else if (status === "delivered") {
          router.push(`/package/${id}`);
        } else {
          router.push(`/generate?resume=${id}`);
        }
      }}
      className={`flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--background-overlay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
        isSelected ? "bg-[var(--background-overlay)]" : ""
      }`}
    >
      {/* Checkbox in select mode */}
      {selectMode && (
        <div
          className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
            isSelected
              ? "border-[var(--accent)] bg-[var(--accent)]"
              : "border-[var(--border)]"
          }`}
        >
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      )}

      {/* Thumbnail placeholder */}
      <div className="size-20 shrink-0 rounded-[var(--radius-md)] bg-[var(--background-overlay)]" />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--foreground-muted)]">
          {truncate(briefText, 60)}
        </p>
        <p className={`mt-1 text-sm ${isFailed ? "text-red-400" : "text-[var(--foreground)]"}`}>
          {STATUS_LABELS[status] ?? status}
        </p>
        <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
          {formatRelativeDate(createdAt)}
        </p>
      </div>

      {/* Status indicator */}
      {!selectMode && (
        <div
          className="size-2 shrink-0 rounded-full"
          style={{
            backgroundColor: isFailed
              ? "#ef4444"
              : isComplete
                ? "var(--success)"
                : "#eab308",
          }}
          aria-label={isFailed ? "Failed" : isComplete ? "Completed" : "In progress"}
        />
      )}
    </button>
  );
}
