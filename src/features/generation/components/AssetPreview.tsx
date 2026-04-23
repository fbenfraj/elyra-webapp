"use client";

import { toast } from "sonner";

type Deliverable = {
  id: string;
  format: string;
  url: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  mimeType: string;
};

type AssetPreviewProps = {
  deliverable: Deliverable;
  variant: "cover" | "instagram-square" | "instagram-story" | "twitter-header" | "palette";
};

const FORMAT_FILENAMES: Record<string, string> = {
  "cover-spotify": "cover-3000x3000.jpg",
  "cover-apple": "cover-apple-3000x3000.jpg",
  "instagram-square": "instagram-square.jpg",
  "instagram-story": "instagram-story.jpg",
  "twitter-header": "twitter-header.jpg",
  "palette": "palette.png",
};

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  toast.success("Download started", { duration: 4000 });
}

export function AssetPreview({ deliverable, variant }: AssetPreviewProps) {
  const filename =
    FORMAT_FILENAMES[deliverable.format] ?? `${deliverable.format}.jpg`;

  const handleClick = () => {
    triggerDownload(deliverable.url, filename);
  };

  if (variant === "cover") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="group relative w-full cursor-pointer overflow-hidden rounded-[var(--radius-lg)] bg-[var(--background-elevated)] transition-transform duration-[var(--duration-normal)] hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {/* Spotify player-style mockup frame */}
        <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-md)]">
          <img
            src={deliverable.url}
            alt="Cover art"
            className="h-full w-full object-cover"
          />
        </div>
        {/* Decorative playback bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-[var(--space-4)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="size-8 rounded-full bg-white/20" />
            <div className="h-1 flex-1 rounded-full bg-white/20">
              <div className="h-full w-1/3 rounded-full bg-white/40" />
            </div>
          </div>
        </div>
        {/* Download hint on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-[var(--duration-normal)] group-hover:bg-black/30">
          <span className="text-sm font-medium text-white opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100">
            Download
          </span>
        </div>
      </button>
    );
  }

  if (variant === "instagram-story") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="group relative mx-auto w-full max-w-[180px] cursor-pointer overflow-hidden rounded-[24px] bg-[var(--background-elevated)] shadow-lg transition-transform duration-[var(--duration-normal)] hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {/* Phone frame mockup */}
        <div className="relative">
          {/* Notch */}
          <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-black" />
          <div className="aspect-[9/16] w-full overflow-hidden">
            <img
              src={deliverable.url}
              alt="Instagram story"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-[var(--duration-normal)] group-hover:bg-black/30">
          <span className="text-sm font-medium text-white opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100">
            Download
          </span>
        </div>
      </button>
    );
  }

  if (variant === "instagram-square") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="group relative mx-auto w-full max-w-[240px] cursor-pointer overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-elevated)] transition-transform duration-[var(--duration-normal)] hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <div className="aspect-square w-full overflow-hidden">
          <img
            src={deliverable.url}
            alt="Instagram square"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-[var(--duration-normal)] group-hover:bg-black/30">
          <span className="text-sm font-medium text-white opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100">
            Download
          </span>
        </div>
      </button>
    );
  }

  if (variant === "twitter-header") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="group relative mx-auto w-full max-w-[480px] cursor-pointer overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-elevated)] transition-transform duration-[var(--duration-normal)] hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <div className="aspect-[3/1] w-full overflow-hidden">
          <img
            src={deliverable.url}
            alt="Twitter header"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-[var(--duration-normal)] group-hover:bg-black/30">
          <span className="text-sm font-medium text-white opacity-0 transition-opacity duration-[var(--duration-normal)] group-hover:opacity-100">
            Download
          </span>
        </div>
      </button>
    );
  }

  if (variant === "palette") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="group relative mx-auto w-full cursor-pointer overflow-hidden rounded-[var(--radius-md)] transition-opacity duration-[var(--duration-normal)] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <img
          src={deliverable.url}
          alt="Color palette"
          className="h-auto w-full"
        />
      </button>
    );
  }

  return null;
}
