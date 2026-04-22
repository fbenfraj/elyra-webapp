"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { BriefInput } from "@/features/generation/components/BriefInput";
import { BriefDisplay } from "@/features/generation/components/BriefDisplay";
import { FollowUpQuestions } from "@/features/generation/components/FollowUpQuestions";
import { StatusPoller } from "@/features/generation/components/StatusPoller";

type PageState =
  | { phase: "input" }
  | { phase: "processing"; sessionId: string; briefText: string }
  | {
      phase: "follow_up";
      sessionId: string;
      briefText: string;
      questions: string[];
    }
  | { phase: "error"; briefText: string; message: string };

export default function GeneratePage() {
  const [state, setState] = useState<PageState>({ phase: "input" });

  const trpc = useTRPC();

  const createSession = useMutation(
    trpc.session.create.mutationOptions({
      onSuccess: (data, variables) => {
        setState({
          phase: "processing",
          sessionId: data.id,
          briefText: variables.text,
        });
        startInterpretation.mutate({ sessionId: data.id });
      },
      onError: () => {
        setState({
          phase: "error",
          briefText: "",
          message:
            "Something went wrong creating your session. Give it another try.",
        });
      },
    })
  );

  const startInterpretation = useMutation(
    trpc.generation.start.mutationOptions({
      onSuccess: (result) => {
        if (state.phase !== "processing") return;

        // Handle TaskResult envelope — ok:false means moderation/provider error
        if (!result.ok) {
          setState({
            phase: "error",
            briefText: state.briefText,
            message:
              result.error?.message ??
              "Something went wrong interpreting your brief. Give it another try.",
          });
          return;
        }

        // Handle follow-up questions branch
        if (result.output?.type === "follow_up") {
          setState({
            phase: "follow_up",
            sessionId: state.sessionId,
            briefText: state.briefText,
            questions: result.output.questions,
          });
          return;
        }

        // Spec returned successfully — poller will pick up the status change
      },
      onError: () => {
        if (state.phase === "processing") {
          setState({
            phase: "error",
            briefText: state.briefText,
            message:
              "Something went wrong interpreting your brief. Give it another try.",
          });
        }
      },
    })
  );

  if (state.phase === "follow_up") {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <BriefDisplay text={state.briefText} />
        <FollowUpQuestions
          questions={state.questions}
          onSubmit={(response) => {
            setState({
              phase: "processing",
              sessionId: state.sessionId,
              briefText: `${state.briefText}\n\n${response}`,
            });
            startInterpretation.mutate({ sessionId: state.sessionId });
          }}
          isSubmitting={startInterpretation.isPending}
        />
      </div>
    );
  }

  if (state.phase === "processing") {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <BriefDisplay text={state.briefText} />
        <StatusPoller sessionId={state.sessionId} />
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        {state.briefText && <BriefDisplay text={state.briefText} />}
        <p className="mx-auto mt-3 max-w-[var(--content-narrow)] text-sm text-[var(--foreground-muted)]">
          {state.message}
        </p>
        <button
          onClick={() => setState({ phase: "input" })}
          className="mt-4 text-sm text-[var(--accent)] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
      <BriefInput
        onSubmit={(text) => createSession.mutate({ text })}
        isSubmitting={createSession.isPending}
      />
    </div>
  );
}
