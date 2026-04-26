"use client";

import { useRouter } from "next/navigation";
import { ASSET_TYPES } from "@/config/asset-types";
import type { AssetTypeId } from "@/config/asset-types";
import { Loader, ArrowDown, XCircle } from "lucide-react";

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

function briefToGradient(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 30% 20%), hsl(${hue2} 25% 15%))`;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon?: React.ComponentType<{ className?: string }>; spin?: boolean }
> = {
  pending: { label: "Pending", color: "#71717a" },
  interpreting: { label: "Interpreting", color: "#eab308", icon: Loader, spin: true },
  generating_directions: { label: "Generating", color: "#eab308", icon: Loader, spin: true },
  selecting: { label: "Choose direction", color: "#3b82f6" },
  direction_selected: { label: "Direction chosen", color: "#22c55e" },
  paid: { label: "Processing", color: "#eab308", icon: Loader, spin: true },
  generating_images: { label: "Creating", color: "#eab308", icon: Loader, spin: true },
  evaluating: { label: "Evaluating", color: "#eab308", icon: Loader, spin: true },
  packaging: { label: "Packaging", color: "#eab308", icon: Loader, spin: true },
  delivered: { label: "Download", color: "#22c55e", icon: ArrowDown },
  complete: { label: "Complete", color: "#22c55e" },
  failed: { label: "Failed", color: "#ef4444", icon: XCircle },
};

type SessionCardProps = {
  id: string;
  briefText: string;
  status: string;
  createdAt: Date;
  assetType?: string;
  previewImageUrl?: string | null;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

export function SessionCard({
  id,
  briefText,
  status,
  createdAt,
  assetType,
  previewImageUrl,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
}: SessionCardProps) {
  const router = useRouter();
  const statusEntry = STATUS_CONFIG[status] ?? { label: status, color: "#71717a" };
  const isInProgress =
    status === "interpreting" ||
    status === "generating_directions" ||
    status === "generating_images" ||
    status === "evaluating" ||
    status === "packaging" ||
    status === "paid";

  const config = assetType ? ASSET_TYPES[assetType as AssetTypeId] : null;

  // Determine aspect ratio CSS class based on asset type
  const aspectClass =
    config?.aspectRatio === "9:16"
      ? "aspect-[9/16]"
      : config?.aspectRatio === "2:3"
        ? "aspect-[2/3]"
        : "aspect-square";

  return (
    <button
      type="button"
      onClick={() => {
        if (selectMode) {
          onToggleSelect?.();
        } else if (status === "delivered") {
          router.push(`/package/${id}`);
        } else {
          router.push(`/generate/${id}`);
        }
      }}
      className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-300 ${
        isSelected
          ? "border-white/40 ring-2 ring-white/20"
          : "border-[var(--border)] hover:border-[#3f3f46]"
      }`}
    >
      {/* Select checkbox */}
      {selectMode && (
        <div className="absolute left-3 top-3 z-20">
          <div
            className={`flex size-5 items-center justify-center rounded-full border-2 transition-colors ${
              isSelected
                ? "border-white bg-white"
                : "border-white/50 bg-black/40 backdrop-blur-sm"
            }`}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6L5 8.5L9.5 3.5"
                  stroke="#09090b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Image area */}
      <div className={`relative w-full overflow-hidden bg-[var(--background-elevated)] ${aspectClass}`}>
        {previewImageUrl ? (
          <img
            src={previewImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: briefToGradient(briefText) }}
          />
        )}

        {/* Gradient overlay at bottom for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Status badge */}
        <div className="absolute right-3 top-3 z-10">
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-md"
            style={{
              backgroundColor: `${statusEntry.color}20`,
              color: statusEntry.color,
              border: `1px solid ${statusEntry.color}30`,
            }}
          >
            {statusEntry.icon && (
              <statusEntry.icon
                className={`size-3 ${statusEntry.spin ? "animate-spin" : ""}`}
              />
            )}
            {statusEntry.label}
          </div>
        </div>

        {/* In-progress shimmer overlay */}
        {isInProgress && !previewImageUrl && (
          <div className="absolute inset-0 animate-pulse bg-white/[0.02]" />
        )}

        {/* Bottom text overlay */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <p className="line-clamp-2 text-[13px] leading-snug text-white/90">
            {briefText}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between bg-[var(--background-elevated)]/80 px-3 py-2">
        <span className="text-[11px] text-[var(--foreground-subtle)]">
          {config?.label ?? "Release Artwork"}
        </span>
        <span className="text-[11px] text-[var(--foreground-subtle)]">
          {formatRelativeDate(createdAt)}
        </span>
      </div>
    </button>
  );
}
