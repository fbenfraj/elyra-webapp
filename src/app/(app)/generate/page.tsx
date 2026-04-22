"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { BriefInput } from "@/features/generation/components/BriefInput";
import { BriefDisplay } from "@/features/generation/components/BriefDisplay";

export default function GeneratePage() {
  const [submittedBrief, setSubmittedBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trpc = useTRPC();
  const createSession = useMutation(
    trpc.session.create.mutationOptions({
      onSuccess: (_data, variables) => {
        setSubmittedBrief(variables.text);
        setError(null);
      },
      onError: () => {
        setError(
          "Something went wrong creating your session. Give it another try."
        );
      },
    })
  );

  if (submittedBrief) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <BriefDisplay text={submittedBrief} />
        <p className="mt-8 text-sm text-[var(--foreground-subtle)]">
          Creative process loading coming in Story 2.3
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
      <BriefInput
        onSubmit={(text) => {
          setError(null);
          createSession.mutate({ text });
        }}
        isSubmitting={createSession.isPending}
      />
      {error && (
        <p className="mx-auto mt-3 max-w-[var(--content-narrow)] text-sm text-[var(--foreground-muted)]">
          {error}
        </p>
      )}
    </div>
  );
}
