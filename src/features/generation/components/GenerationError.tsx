"use client";

interface GenerationErrorProps {
  /** User-friendly error message. Never includes provider names or technical details. */
  message?: string;
  /** Whether the user can retry this action */
  canRetry?: boolean;
  /** Callback when user clicks retry */
  onRetry?: () => void;
  /** If true, shows a link to edit the brief instead of retry */
  showEditBrief?: boolean;
  /** Callback when user clicks to edit brief */
  onEditBrief?: () => void;
  /** Optional brief text to show as dimmed context */
  briefText?: string;
}

export function GenerationError({
  message = "Something went wrong. Try again?",
  canRetry = true,
  onRetry,
  showEditBrief = false,
  onEditBrief,
  briefText,
}: GenerationErrorProps) {
  return (
    <div className="relative mx-auto w-full max-w-[var(--content-narrow)]">
      {/* Dimmed brief context */}
      {briefText && (
        <div className="mb-6 opacity-40">
          <p className="text-sm text-[var(--foreground-muted)]">Your brief</p>
          <p className="mt-1 text-base text-[var(--foreground)]">
            {briefText}
          </p>
        </div>
      )}

      {/* Inline error — never full-screen */}
      <div
        role="alert"
        className="rounded-lg border border-[var(--foreground-subtle)]/20 bg-[var(--background)]/80 px-6 py-5 text-center"
      >
        <p className="text-base text-[var(--foreground)]">{message}</p>

        <div className="mt-4 flex items-center justify-center gap-4">
          {canRetry && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-[var(--foreground-subtle)] px-4 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            >
              Try again
            </button>
          )}

          {showEditBrief && onEditBrief && (
            <button
              type="button"
              onClick={onEditBrief}
              className="rounded-md border border-[var(--foreground-subtle)] px-4 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            >
              Edit your brief
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
