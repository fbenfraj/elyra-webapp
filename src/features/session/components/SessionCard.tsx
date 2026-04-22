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
  evaluating: "Evaluating",
  packaging: "Packaging",
  complete: "Completed",
  failed: "Failed",
};

type SessionCardProps = {
  id: string;
  briefText: string;
  status: string;
  createdAt: Date;
};

export function SessionCard({
  id,
  briefText,
  status,
  createdAt,
}: SessionCardProps) {
  const router = useRouter();
  const isComplete = status === "complete";

  return (
    <button
      type="button"
      onClick={() => router.push(`/package/${id}`)}
      className="flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--background-overlay)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {/* Thumbnail placeholder */}
      <div className="size-20 shrink-0 rounded-[var(--radius-md)] bg-[var(--background-overlay)]" />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--foreground-muted)]">
          {truncate(briefText, 60)}
        </p>
        <p className="mt-1 text-sm text-[var(--foreground)]">
          {STATUS_LABELS[status] ?? status}
        </p>
        <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
          {formatRelativeDate(createdAt)}
        </p>
      </div>

      {/* Status indicator */}
      <div
        className="size-2 shrink-0 rounded-full"
        style={{
          backgroundColor: isComplete
            ? "var(--success)"
            : "#eab308",
        }}
        aria-label={isComplete ? "Completed" : "In progress"}
      />
    </button>
  );
}
