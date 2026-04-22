"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BriefInput } from "@/features/generation/components/BriefInput";
import { BriefDisplay } from "@/features/generation/components/BriefDisplay";
import { FollowUpQuestions } from "@/features/generation/components/FollowUpQuestions";
import { StatusPoller } from "@/features/generation/components/StatusPoller";
import { CreativeProcessLoader } from "@/features/generation/components/CreativeProcessLoader";
import type { Direction } from "@/lib/schemas/direction";

type PageState =
  | { phase: "input" }
  | { phase: "processing"; sessionId: string; briefText: string }
  | {
      phase: "follow_up";
      sessionId: string;
      briefText: string;
      questions: string[];
    }
  | {
      phase: "generating_directions";
      sessionId: string;
      briefText: string;
    }
  | {
      phase: "directions_ready";
      sessionId: string;
      briefText: string;
      directions: Direction[];
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

        // Spec returned successfully — transition to direction generation
        setState({
          phase: "generating_directions",
          sessionId: state.sessionId,
          briefText: state.briefText,
        });
        startDirections.mutate({ sessionId: state.sessionId });
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

  const startDirections = useMutation(
    trpc.generation.startDirections.mutationOptions({
      onSuccess: () => {
        // Task queued via Trigger.dev — UI polls getStatus for completion
      },
      onError: () => {
        if (state.phase === "generating_directions") {
          setState({
            phase: "error",
            briefText: state.briefText,
            message:
              "Something went wrong generating your directions. Give it another try.",
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

  if (state.phase === "generating_directions") {
    return (
      <DirectionPollingPhase
        sessionId={state.sessionId}
        briefText={state.briefText}
        onComplete={(directions) =>
          setState({
            phase: "directions_ready",
            sessionId: state.sessionId,
            briefText: state.briefText,
            directions,
          })
        }
        onError={(message) =>
          setState({ phase: "error", briefText: state.briefText, message })
        }
      />
    );
  }

  if (state.phase === "directions_ready") {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <BriefDisplay text={state.briefText} />
        <p className="mt-8 text-lg text-[var(--foreground)]">
          {state.directions.length} directions ready
        </p>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          Direction reveal coming in Story 2.4
        </p>
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

function DirectionPollingPhase({
  sessionId,
  briefText,
  onComplete,
  onError,
}: {
  sessionId: string;
  briefText: string;
  onComplete: (directions: Direction[]) => void;
  onError: (message: string) => void;
}) {
  const trpc = useTRPC();

  // Poll session status every 3s
  const { data: statusData } = useQuery(
    trpc.generation.getStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (status === "complete" || status === "failed") return false;
          return 3000;
        },
      }
    )
  );

  // When status is complete, fetch directions
  const { data: directionsData } = useQuery(
    trpc.generation.getDirections.queryOptions(
      { sessionId },
      { enabled: statusData?.status === "complete" }
    )
  );

  // Transition when directions arrive
  if (directionsData?.directions) {
    onComplete(directionsData.directions);
  }

  if (statusData?.status === "failed") {
    onError("Something went wrong generating your directions. Give it another try.");
  }

  return <CreativeProcessLoader briefText={briefText} />;
}
