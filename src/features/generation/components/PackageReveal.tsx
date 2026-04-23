"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { AssetPreview } from "@/features/generation/components/AssetPreview";
import { DownloadActions } from "@/features/generation/components/DownloadActions";

type Deliverable = {
  id: string;
  format: string;
  url: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  mimeType: string;
};

type PackageRevealProps = {
  sessionId: string;
  briefText: string;
};

export function PackageReveal({ sessionId, briefText }: PackageRevealProps) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.package.get.queryOptions({ sessionId })
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <p className="text-sm text-[var(--foreground-muted)]">
          Loading your package...
        </p>
      </div>
    );
  }

  const deliverables = data?.deliverables ?? [];
  const cover = deliverables.find(
    (d) => d.format === "cover-spotify" || d.format === "cover-apple"
  );
  const instagramSquare = deliverables.find(
    (d) => d.format === "instagram-square"
  );
  const instagramStory = deliverables.find(
    (d) => d.format === "instagram-story"
  );
  const twitterHeader = deliverables.find(
    (d) => d.format === "twitter-header"
  );
  const palette = deliverables.find((d) => d.format === "palette");
  const directionSummary = deliverables.find(
    (d) => d.format === "direction-summary"
  );

  return (
    <div className="mx-auto w-full max-w-[var(--content-medium)] px-[var(--space-4)] py-[var(--space-8)]">
      {/* Label */}
      <div
        className="animate-reveal"
        style={{ "--reveal-delay": "0ms" } as React.CSSProperties}
      >
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
          Your creative direction
        </p>
        <p className="mt-[var(--space-1)] text-sm text-[var(--foreground-muted)]">
          {briefText || "Your release pack"}
        </p>
      </div>

      {/* Cover art hero */}
      <div
        className="animate-reveal mt-[var(--space-8)]"
        style={{ "--reveal-delay": "100ms" } as React.CSSProperties}
      >
        {cover && (
          <div className="mx-auto w-full md:max-w-[400px]">
            <AssetPreview deliverable={cover} variant="cover" />
          </div>
        )}
      </div>

      {/* Social format mockups */}
      <div
        className="animate-reveal mt-[var(--space-8)]"
        style={{ "--reveal-delay": "300ms" } as React.CSSProperties}
      >
        <div className="flex flex-col gap-[var(--space-4)] md:flex-row md:justify-center">
          {instagramSquare && (
            <AssetPreview
              deliverable={instagramSquare}
              variant="instagram-square"
            />
          )}
          {instagramStory && (
            <AssetPreview
              deliverable={instagramStory}
              variant="instagram-story"
            />
          )}
          {twitterHeader && (
            <AssetPreview
              deliverable={twitterHeader}
              variant="twitter-header"
            />
          )}
        </div>
      </div>

      {/* Palette */}
      <div
        className="animate-reveal mt-[var(--space-8)]"
        style={{ "--reveal-delay": "500ms" } as React.CSSProperties}
      >
        {palette && (
          <AssetPreview deliverable={palette} variant="palette" />
        )}
      </div>

      {/* Direction summary */}
      <div
        className="animate-reveal mt-[var(--space-8)]"
        style={{ "--reveal-delay": "700ms" } as React.CSSProperties}
      >
        {directionSummary && (
          <DirectionSummaryDisplay url={directionSummary.url} />
        )}
      </div>

      {/* Download actions — sticky on mobile */}
      <div
        className="animate-reveal mt-[var(--space-8)] md:mt-[var(--space-12)]"
        style={{ "--reveal-delay": "800ms" } as React.CSSProperties}
      >
        <div className="sticky bottom-0 z-10 bg-[var(--background)] py-[var(--space-4)] md:static md:bg-transparent md:py-0">
          <DownloadActions sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}

function DirectionSummaryDisplay({ url }: { url: string }) {
  const { data } = useQuery({
    queryKey: ["direction-summary", url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json() as Promise<{
        moodLabel: string;
        description: string;
        palette: { hex: string; index: number }[];
        tags: string[];
      }>;
    },
    staleTime: Infinity,
  });

  if (!data) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background-elevated)] p-[var(--space-6)]">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
        Direction summary
      </p>
      <p className="mt-[var(--space-2)] text-lg font-semibold text-[var(--foreground)]">
        {data.moodLabel}
      </p>
      <p className="mt-[var(--space-2)] text-sm text-[var(--foreground-muted)]">
        {data.description}
      </p>

      {/* Palette swatches */}
      <div className="mt-[var(--space-4)] flex gap-[var(--space-4)]">
        {data.palette.map((color) => (
          <div key={color.index} className="flex flex-col items-center gap-[var(--space-1)]">
            <div
              className="size-12 rounded-full"
              style={{ backgroundColor: color.hex }}
            />
            <span className="font-mono text-xs text-[var(--foreground-subtle)]">
              {color.hex}
            </span>
          </div>
        ))}
      </div>

      {/* Tags */}
      {data.tags.length > 0 && (
        <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
          {data.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[var(--radius-full)] bg-[var(--background-overlay)] px-[var(--space-3)] py-[var(--space-1)] text-xs text-[var(--foreground-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
