"use client";

import { useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

const MIN_HEIGHT = 72;
const MAX_HEIGHT = 144;

export function BriefInput({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (text: string) => void;
  isSubmitting: boolean;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedText = text.trim();
  const canSubmit = trimmedText.length > 0 && !isSubmitting;

  const handleSubmit = useCallback(() => {
    if (trimmedText.length > 0 && !isSubmitting) {
      onSubmit(trimmedText);
    }
  }, [trimmedText, isSubmitting, onSubmit]);

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;

    if (scrollHeight <= MAX_HEIGHT) {
      textarea.style.height = `${Math.max(scrollHeight, MIN_HEIGHT)}px`;
      textarea.style.overflowY = "hidden";
    } else {
      textarea.style.height = `${MAX_HEIGHT}px`;
      textarea.style.overflowY = "auto";
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="mx-auto w-full max-w-[var(--content-narrow)]">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          handleInput();
        }}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        placeholder="dark cinematic trap, nighttime city, moody blue tones..."
        rows={3}
        className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-3 text-[var(--text-lg)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
        style={{
          minHeight: `${MIN_HEIGHT}px`,
          maxHeight: `${MAX_HEIGHT}px`,
          overflowY: "hidden",
        }}
      />
      <div className="mt-4 flex w-full justify-center">
        <Button
          variant="ghost-secondary"
          size="lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full md:w-auto md:min-w-[200px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Creating...
            </span>
          ) : (
            "Create directions"
          )}
        </Button>
      </div>
    </div>
  );
}
