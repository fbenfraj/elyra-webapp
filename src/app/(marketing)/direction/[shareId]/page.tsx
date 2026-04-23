import { notFound } from "next/navigation";
import { getSharedDirection } from "@/server/services/sharing";

type Props = {
  params: Promise<{ shareId: string }>;
};

export default async function SharedDirectionPage({ params }: Props) {
  const { shareId } = await params;
  const direction = await getSharedDirection(shareId);

  if (!direction) {
    notFound();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="mx-auto w-full max-w-[var(--content-narrow)] px-[var(--space-4)] py-[var(--space-16)]">
        {/* Header */}
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
          Creative direction
        </p>

        {/* Mood label */}
        <h1 className="mt-[var(--space-4)] text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
          {direction.moodLabel}
        </h1>

        {/* Description */}
        <p className="mt-[var(--space-4)] text-base leading-relaxed text-[var(--foreground-muted)]">
          {direction.description}
        </p>

        {/* Palette swatches */}
        {direction.palette.length > 0 && (
          <div className="mt-[var(--space-8)]">
            <p className="mb-[var(--space-3)] text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
              Color palette
            </p>
            <div className="flex gap-[var(--space-4)]">
              {direction.palette.map((hex, i) => (
                <div key={i} className="flex flex-col items-center gap-[var(--space-1)]">
                  <div
                    className="size-12 rounded-full"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="font-mono text-xs text-[var(--foreground-subtle)]">
                    {hex}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {direction.tags.length > 0 && (
          <div className="mt-[var(--space-8)]">
            <p className="mb-[var(--space-3)] text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
              Visual attributes
            </p>
            <div className="flex flex-wrap gap-[var(--space-2)]">
              {direction.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[var(--radius-full)] bg-[var(--background-overlay)] px-[var(--space-3)] py-[var(--space-1)] text-sm text-[var(--foreground-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Branding */}
        <div className="mt-[var(--space-16)] border-t border-[var(--border)] pt-[var(--space-6)]">
          <p className="text-xs text-[var(--foreground-subtle)]">
            Created with Elyra
          </p>
        </div>
      </div>
    </div>
  );
}
