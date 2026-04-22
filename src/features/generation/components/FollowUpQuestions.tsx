"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

export function FollowUpQuestions({
  questions,
  onSubmit,
  isSubmitting,
}: {
  questions: string[];
  onSubmit: (response: string) => void;
  isSubmitting: boolean;
}) {
  const [response, setResponse] = useState("");
  const trimmedResponse = response.trim();
  const canSubmit = trimmedResponse.length > 0 && !isSubmitting;

  const handleSubmit = useCallback(() => {
    if (canSubmit) {
      onSubmit(trimmedResponse);
    }
  }, [canSubmit, trimmedResponse, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="mx-auto mt-6 w-full max-w-[var(--content-narrow)]">
      <div className="space-y-3">
        {questions.map((question) => (
          <p
            key={question}
            className="text-sm text-[var(--foreground-muted)]"
          >
            {question}
          </p>
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        <input
          type="text"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting}
          placeholder="describe what you're looking for..."
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
        />
        <Button
          variant="ghost-secondary"
          size="default"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Sending
            </span>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </div>
  );
}
