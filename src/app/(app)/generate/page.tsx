"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BriefInput } from "@/features/generation/components/BriefInput";
import { BriefDisplay } from "@/features/generation/components/BriefDisplay";
import { FollowUpQuestions } from "@/features/generation/components/FollowUpQuestions";
import { StatusPoller } from "@/features/generation/components/StatusPoller";
import { CreativeProcessLoader } from "@/features/generation/components/CreativeProcessLoader";
import { GenerationError } from "@/features/generation/components/GenerationError";
import { useGenerationStatus } from "@/features/generation/lib/use-generation-status";
import { DirectionGrid } from "@/features/generation/components/DirectionGrid";
import { DirectionCard } from "@/features/generation/components/DirectionCard";
import { RecoveryFlow } from "@/features/generation/components/RecoveryFlow";
import type { Direction } from "@/lib/schemas/direction";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PaywallModal } from "@/features/payment/components/PaywallModal";
import { ImageSelection } from "@/features/generation/components/ImageSelection";
import { PackageReveal } from "@/features/generation/components/PackageReveal";
import { trpcClient } from "@/lib/trpc/client";

type DirectionRound = {
  generationJobId: string;
  directions: Direction[];
};

type PageState =
  | { phase: "input" }
  | { phase: "resuming"; sessionId: string }
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
      generationJobId: string;
    }
  | {
      phase: "recovering";
      sessionId: string;
      briefText: string;
      directions: Direction[];
      generationJobId: string;
    }
  | {
      phase: "direction_selected";
      sessionId: string;
      briefText: string;
      directions: Direction[];
      generationJobId: string;
      selectedDirectionId: string;
      showPaywall: boolean;
    }
  | {
      phase: "paid";
      sessionId: string;
      briefText: string;
      directions: Direction[];
      generationJobId: string;
      selectedDirectionId: string;
    }
  | {
      phase: "generating_images";
      sessionId: string;
      briefText: string;
      heroImageUrl: string | null;
    }
  | {
      phase: "selecting";
      sessionId: string;
      briefText: string;
    }
  | {
      phase: "packaging";
      sessionId: string;
      briefText: string;
    }
  | {
      phase: "delivered";
      sessionId: string;
      briefText: string;
    }
  | { phase: "error"; briefText: string; message: string };

function getInitialStateFromParams(searchParams: URLSearchParams): PageState {
  const paymentStatus = searchParams.get("payment");
  const sessionId = searchParams.get("session_id");

  if (paymentStatus === "success" && sessionId) {
    return {
      phase: "paid",
      sessionId,
      briefText: "",
      directions: [],
      generationJobId: "",
      selectedDirectionId: "",
    };
  }

  if (paymentStatus === "cancelled" && sessionId) {
    return {
      phase: "direction_selected",
      sessionId,
      briefText: "",
      directions: [],
      generationJobId: "",
      selectedDirectionId: "",
      showPaywall: true,
    };
  }

  // Resume an existing session from the dashboard
  const resumeId = searchParams.get("resume");
  if (resumeId) {
    return { phase: "resuming", sessionId: resumeId };
  }

  return { phase: "input" };
}

export default function GeneratePage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<PageState>(() =>
    getInitialStateFromParams(searchParams)
  );
  // Track previous direction rounds for dimming/gallery
  const [previousRounds, setPreviousRounds] = useState<DirectionRound[]>([]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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

        if (result.output?.type === "follow_up") {
          setState({
            phase: "follow_up",
            sessionId: state.sessionId,
            briefText: state.briefText,
            questions: result.output.questions,
          });
          return;
        }

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

  const refineGeneration = useMutation(
    trpc.generation.refine.mutationOptions({
      onSuccess: (result) => {
        if (state.phase === "input" || state.phase === "error" || state.phase === "resuming") return;

        if (!result.ok) {
          setState({
            phase: "error",
            briefText: state.briefText,
            message:
              result.error?.message ??
              "Something went wrong refining your brief. Give it another try.",
          });
          return;
        }

        if (result.output?.type === "follow_up") {
          setState({
            phase: "follow_up",
            sessionId: state.sessionId,
            briefText: state.briefText,
            questions: result.output.questions,
          });
          return;
        }

        // Interpretation succeeded — move to direction generation
        setState({
          phase: "generating_directions",
          sessionId: state.sessionId,
          briefText: state.briefText,
        });
        startDirections.mutate({ sessionId: state.sessionId });
      },
      onError: () => {
        if (state.phase !== "input" && state.phase !== "error" && state.phase !== "resuming") {
          setState({
            phase: "error",
            briefText: state.briefText,
            message:
              "Something went wrong refining your brief. Give it another try.",
          });
        }
      },
    })
  );

  const handleCheckoutRedirect = useCallback((url: string) => {
    window.location.href = url;
  }, []);

  const createCheckout = useMutation(
    trpc.payment.createCheckout.mutationOptions({
      onSuccess: (data) => {
        if (data.checkoutUrl) {
          handleCheckoutRedirect(data.checkoutUrl);
        }
      },
      onError: () => {
        setCheckoutError(
          "Payment didn't go through. Try a different card?"
        );
      },
    })
  );

  // Show toast and clean URL on payment return
  const toastShownRef = useRef(false);
  useEffect(() => {
    if (toastShownRef.current) return;
    const paymentParam = searchParams.get("payment");
    if (paymentParam === "success") {
      toastShownRef.current = true;
      toast.success("Payment confirmed", { duration: 4000 });
    }
    // Clean up query params from URL
    if (paymentParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams]);

  // Resume an existing session: fetch its status and transition to the right phase
  useEffect(() => {
    if (state.phase !== "resuming") return;
    const sessionId = state.sessionId;

    async function resume() {
      try {
        const status = await trpcClient.generation.getStatus.query({ sessionId });
        const briefText = status.briefText ?? "";
        const sessionStatus = status.status as string;

        // Map DB status → page phase
        if (sessionStatus === "pending") {
          setState({ phase: "input" });
        } else if (sessionStatus === "interpreting") {
          setState({ phase: "processing", sessionId, briefText });
        } else if (sessionStatus === "generating_directions") {
          setState({ phase: "generating_directions", sessionId, briefText });
        } else if (sessionStatus === "selecting" || sessionStatus === "complete") {
          // Directions are ready — fetch them
          const dirData = await trpcClient.generation.getDirections.query({ sessionId });
          if (dirData.directions && dirData.generationJobId) {
            setState({
              phase: "directions_ready",
              sessionId,
              briefText,
              directions: dirData.directions,
              generationJobId: dirData.generationJobId,
            });
          } else {
            setState({ phase: "generating_directions", sessionId, briefText });
          }
        } else if (sessionStatus === "direction_selected") {
          setState({
            phase: "direction_selected",
            sessionId,
            briefText,
            directions: [],
            generationJobId: "",
            selectedDirectionId: "",
            showPaywall: true,
          });
        } else if (sessionStatus === "paid") {
          setState({
            phase: "paid",
            sessionId,
            briefText,
            directions: [],
            generationJobId: "",
            selectedDirectionId: "",
          });
        } else if (sessionStatus === "generating_images" || sessionStatus === "evaluating") {
          setState({
            phase: "generating_images",
            sessionId,
            briefText,
            heroImageUrl: null,
          });
        } else if (sessionStatus === "packaging") {
          setState({ phase: "packaging", sessionId, briefText });
        } else if (sessionStatus === "delivered") {
          setState({ phase: "delivered", sessionId, briefText });
        } else if (sessionStatus === "failed") {
          setState({
            phase: "error",
            briefText,
            message: "This session failed. You can start a new one.",
          });
        } else {
          setState({ phase: "input" });
        }
      } catch {
        setState({
          phase: "error",
          briefText: "",
          message: "Could not load session. Try again.",
        });
      }
    }

    resume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase === "resuming" ? state.sessionId : null]);

  // Track screen enter/exit for phases with a sessionId
  const currentPhase = state.phase;
  const currentSessionId = "sessionId" in state ? state.sessionId : null;
  useEffect(() => {
    if (!currentSessionId) return;
    void trpcClient.feedback.captureEvent.mutate({
      sessionId: currentSessionId,
      action: "screen_entered",
      payload: { screen: currentPhase },
    });
    const enteredAt = Date.now();
    return () => {
      void trpcClient.feedback.captureEvent.mutate({
        sessionId: currentSessionId,
        action: "screen_exited",
        payload: { screen: currentPhase, durationMs: Date.now() - enteredAt },
      });
    };
  }, [currentPhase, currentSessionId]);

  const handleDirectionsComplete = useCallback(
    (directions: Direction[], generationJobId: string) => {
      setState((prev) => {
        if (prev.phase !== "generating_directions") return prev;
        return {
          phase: "directions_ready",
          sessionId: prev.sessionId,
          briefText: prev.briefText,
          directions,
          generationJobId,
        };
      });
    },
    []
  );

  const handleDirectionsError = useCallback(
    (message: string) => {
      setState((prev) => {
        if (prev.phase !== "generating_directions") return prev;
        return { phase: "error", briefText: prev.briefText, message };
      });
    },
    []
  );

  const handleRecovery = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== "directions_ready") return prev;
      void trpcClient.feedback.captureEvent.mutate({
        sessionId: prev.sessionId,
        action: "recovery_started",
      });
      // Push current directions to previous rounds
      setPreviousRounds((rounds) => [
        ...rounds,
        { generationJobId: prev.generationJobId, directions: prev.directions },
      ]);
      return {
        phase: "recovering",
        sessionId: prev.sessionId,
        briefText: prev.briefText,
        directions: prev.directions,
        generationJobId: prev.generationJobId,
      };
    });
  }, []);

  const handleRecoverySubmit = useCallback(
    (data: { selectedPills: string[]; refinementText: string }) => {
      if (state.phase === "input" || state.phase === "error" || state.phase === "resuming") return;
      void trpcClient.feedback.captureEvent.mutate({
        sessionId: state.sessionId,
        action: "brief_refined",
        payload: {
          selectedPills: data.selectedPills,
          hasRefinementText: data.refinementText.length > 0,
        },
      });
      setState({
        phase: "processing",
        sessionId: state.sessionId,
        briefText: state.briefText,
      });
      refineGeneration.mutate({
        sessionId: state.sessionId,
        selectedPills: data.selectedPills,
        refinementText: data.refinementText,
      });
    },
    [state, refineGeneration]
  );

  // Gallery mode: 3+ rounds of previous directions
  const isGalleryMode = previousRounds.length >= 3;

  if (state.phase === "resuming") {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <p className="text-sm text-[var(--foreground-muted)]">Loading session...</p>
      </div>
    );
  }

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
        onComplete={handleDirectionsComplete}
        onError={handleDirectionsError}
      />
    );
  }

  if (
    state.phase === "directions_ready" ||
    state.phase === "direction_selected" ||
    state.phase === "recovering"
  ) {
    return (
      <DirectionRevealPhase
        sessionId={state.sessionId}
        briefText={state.briefText}
        directions={state.phase === "recovering" ? [] : state.directions}
        generationJobId={state.generationJobId}
        selectedDirectionId={
          state.phase === "direction_selected" ? state.selectedDirectionId : null
        }
        showPaywall={
          state.phase === "direction_selected" ? state.showPaywall : false
        }
        onPaywallClose={() => {
          if (state.phase === "direction_selected") {
            setState({ ...state, showPaywall: false });
          }
        }}
        onPaywallUnlock={() => {
          setCheckoutError(null);
          createCheckout.mutate({ sessionId: state.sessionId });
        }}
        checkoutError={checkoutError}
        isCheckoutLoading={createCheckout.isPending}
        onSelected={(directionId, jobId) =>
          setState({
            phase: "direction_selected",
            sessionId: state.sessionId,
            briefText: state.briefText,
            directions: state.directions,
            generationJobId: jobId,
            selectedDirectionId: directionId,
            showPaywall: true,
          })
        }
        onRecovery={handleRecovery}
        isRecovering={state.phase === "recovering"}
        onRecoverySubmit={handleRecoverySubmit}
        isRefining={refineGeneration.isPending}
        previousRounds={previousRounds}
        isGalleryMode={isGalleryMode}
      />
    );
  }

  if (state.phase === "paid") {
    return (
      <PaidPhase
        sessionId={state.sessionId}
        briefText={state.briefText}
        heroImageUrl={
          state.directions.find((d) => d.id === state.selectedDirectionId)?.heroImageUrl ?? null
        }
        onImageGenerationStarted={(heroImageUrl) =>
          setState({
            phase: "generating_images",
            sessionId: state.sessionId,
            briefText: state.briefText,
            heroImageUrl,
          })
        }
      />
    );
  }

  if (state.phase === "generating_images") {
    return (
      <ImageGenerationPhase
        sessionId={state.sessionId}
        briefText={state.briefText}
        heroImageUrl={state.heroImageUrl}
        onSelectingReady={() =>
          setState({
            phase: "selecting",
            sessionId: state.sessionId,
            briefText: state.briefText,
          })
        }
        onError={(message) =>
          setState({
            phase: "error",
            briefText: state.briefText,
            message,
          })
        }
      />
    );
  }

  if (state.phase === "selecting") {
    return (
      <SelectionPhase
        sessionId={state.sessionId}
        briefText={state.briefText}
        onPackagingStarted={() =>
          setState({
            phase: "packaging",
            sessionId: state.sessionId,
            briefText: state.briefText,
          })
        }
      />
    );
  }

  if (state.phase === "packaging") {
    return (
      <PackagingPhase
        sessionId={state.sessionId}
        briefText={state.briefText}
        onDelivered={() =>
          setState({
            phase: "delivered",
            sessionId: state.sessionId,
            briefText: state.briefText,
          })
        }
      />
    );
  }

  if (state.phase === "delivered") {
    return (
      <PackageReveal sessionId={state.sessionId} briefText={state.briefText} />
    );
  }

  if (state.phase === "error") {
    const isContentPolicy = state.message.includes("Try adjusting your brief");
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <GenerationError
          message={state.message}
          canRetry={!isContentPolicy}
          onRetry={() => setState({ phase: "input" })}
          showEditBrief={isContentPolicy}
          onEditBrief={() => setState({ phase: "input" })}
          briefText={state.briefText}
        />
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
  onComplete: (directions: Direction[], generationJobId: string) => void;
  onError: (message: string) => void;
}) {
  const trpc = useTRPC();
  const { timeoutLevel, reset: resetTimeout } = useGenerationStatus({
    phase: "generating_directions",
  });

  const { data: statusData } = useQuery(
    trpc.generation.getStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (status === "selecting" || status === "complete" || status === "failed") return false;
          return 3000;
        },
      }
    )
  );

  const { data: directionsData } = useQuery(
    trpc.generation.getDirections.queryOptions(
      { sessionId },
      { enabled: statusData?.status === "selecting" }
    )
  );

  const retryMutation = useMutation(
    trpc.generation.retry.mutationOptions({
      onSuccess: () => {
        resetTimeout();
      },
      onError: () => {
        onError("Something went wrong. Give it another try.");
      },
    })
  );

  useEffect(() => {
    if (directionsData?.directions && directionsData?.generationJobId) {
      onComplete(directionsData.directions, directionsData.generationJobId);
    }
  }, [directionsData?.directions, directionsData?.generationJobId, onComplete]);

  useEffect(() => {
    if (statusData?.status === "failed" && statusData.canRetry === false) {
      // Non-retryable failure (e.g. content policy)
      onError(
        statusData.failedStage === "content_policy"
          ? "We couldn't generate that image. Try adjusting your brief."
          : "Something went wrong generating your directions."
      );
    }
  }, [statusData?.status, statusData?.canRetry, statusData?.failedStage, onError]);

  // Show inline error for retryable server failures
  if (statusData?.status === "failed" && statusData.canRetry) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <GenerationError
          message="Something went wrong. Try again?"
          canRetry
          onRetry={() => retryMutation.mutate({ sessionId })}
          briefText={briefText}
        />
      </div>
    );
  }

  return (
    <CreativeProcessLoader
      briefText={briefText}
      timeoutLevel={timeoutLevel}
      onRetry={() => retryMutation.mutate({ sessionId })}
    />
  );
}

function DirectionRevealPhase({
  sessionId,
  briefText,
  directions,
  generationJobId,
  selectedDirectionId,
  showPaywall,
  onSelected,
  onRecovery,
  isRecovering,
  onRecoverySubmit,
  isRefining,
  previousRounds,
  isGalleryMode,
  onPaywallClose,
  onPaywallUnlock,
  checkoutError,
  isCheckoutLoading,
}: {
  sessionId: string;
  briefText: string;
  directions: Direction[];
  generationJobId: string;
  selectedDirectionId: string | null;
  showPaywall: boolean;
  onSelected: (directionId: string, generationJobId: string) => void;
  onRecovery: () => void;
  isRecovering: boolean;
  onRecoverySubmit: (data: {
    selectedPills: string[];
    refinementText: string;
  }) => void;
  isRefining: boolean;
  previousRounds: DirectionRound[];
  isGalleryMode: boolean;
  onPaywallClose: () => void;
  onPaywallUnlock: () => void;
  checkoutError?: string | null;
  isCheckoutLoading?: boolean;
}) {
  const trpc = useTRPC();

  const selectDirection = useMutation(
    trpc.generation.selectDirection.mutationOptions({
      onSuccess: (_data, variables) => {
        void trpcClient.feedback.captureEvent.mutate({
          sessionId,
          action: "direction_selected",
          payload: { directionId: variables.directionId },
        });
        onSelected(variables.directionId, variables.generationJobId ?? generationJobId);
      },
    })
  );

  const handleSelectFromRound = (
    directionId: string,
    roundJobId: string
  ) => {
    selectDirection.mutate({ sessionId, directionId, generationJobId: roundJobId });
  };

  return (
    <div
      style={{
        animation:
          "fadeIn var(--duration-normal, 200ms) var(--ease-enter, ease-out)",
      }}
    >
      {/* Gallery mode: show ALL directions from all rounds */}
      {isGalleryMode ? (
        <div className="flex min-h-[calc(100dvh-48px)] flex-col items-center pt-[var(--space-8)]">
          <div className="w-full max-w-[var(--content-wide)]">
            <BriefDisplay text={briefText} />
          </div>

          {previousRounds.map((round, roundIdx) => (
            <div key={roundIdx} className="mt-[var(--space-8)] w-full max-w-[var(--content-wide)]">
              <p className="mb-[var(--space-4)] text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
                Round {roundIdx + 1}
              </p>
              <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2">
                {round.directions.map((direction, dirIdx) => (
                  <DirectionCard
                    key={direction.id}
                    direction={direction}
                    index={dirIdx}
                    isExpanded={false}
                    isSelected={false}
                    isDimmed={false}
                    onToggleExpand={() => {}}
                    onSelect={() => handleSelectFromRound(direction.id, round.generationJobId)}
                    isSelectPending={selectDirection.isPending}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Latest round (if not recovering) */}
          {directions.length > 0 && (
            <div className="mt-[var(--space-8)] w-full max-w-[var(--content-wide)]">
              <p className="mb-[var(--space-4)] text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
                Round {previousRounds.length + 1}
              </p>
              <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2">
                {directions.map((direction, dirIdx) => (
                  <DirectionCard
                    key={direction.id}
                    direction={direction}
                    index={dirIdx}
                    isExpanded={false}
                    isSelected={false}
                    isDimmed={false}
                    onToggleExpand={() => {}}
                    onSelect={() => {
                      selectDirection.mutate({
                        sessionId,
                        directionId: direction.id,
                        generationJobId,
                      });
                    }}
                    isSelectPending={selectDirection.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Graceful exit message */}
          <div className="mt-[var(--space-12)] mb-[var(--space-8)] text-center">
            <p className="text-base text-[var(--foreground-muted)]">
              This one is tricky. Try a more specific reference next time.
            </p>
            <Link
              href="/dashboard"
              className="mt-[var(--space-4)] inline-block text-sm text-[var(--foreground-muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
            >
              Back to dashboard
            </Link>
          </div>

          {/* Recovery flow for trying yet another angle */}
          {isRecovering && (
            <div className="mb-[var(--space-12)] flex w-full justify-center px-[var(--space-4)]">
              <RecoveryFlow
                onSubmit={onRecoverySubmit}
                isSubmitting={isRefining}
                onPillSelected={(pill) => {
                  void trpcClient.feedback.captureEvent.mutate({
                    sessionId,
                    action: "suggestion_pill_selected",
                    payload: { pill },
                  });
                }}
              />
            </div>
          )}

          {!isRecovering && (
            <button
              type="button"
              onClick={onRecovery}
              className="mb-[var(--space-8)] text-sm font-normal text-[var(--foreground-muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
            >
              None of these -- try a different angle
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Previous rounds (dimmed but still selectable) */}
          {previousRounds.map((round, roundIdx) => (
            <div
              key={roundIdx}
              className="flex flex-col items-center"
              style={{ opacity: 0.4, transition: "opacity var(--duration-normal, 200ms)" }}
            >
              <div className="w-full max-w-[var(--content-wide)] pt-[var(--space-4)]">
                <p className="mb-[var(--space-2)] text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
                  Round {roundIdx + 1}
                </p>
                <div className="hidden gap-[var(--space-4)] md:grid md:grid-cols-3">
                  {round.directions.map((direction, dirIdx) => (
                    <DirectionCard
                      key={direction.id}
                      direction={direction}
                      index={dirIdx}
                      isExpanded={false}
                      isSelected={false}
                      isDimmed={false}
                      onToggleExpand={() => {}}
                      onSelect={() => handleSelectFromRound(direction.id, round.generationJobId)}
                      isSelectPending={selectDirection.isPending}
                    />
                  ))}
                </div>
                {/* Mobile: show stacked small cards for previous rounds */}
                <div className="flex gap-[var(--space-2)] overflow-x-auto md:hidden">
                  {round.directions.map((direction, dirIdx) => (
                    <div key={direction.id} className="w-[200px] shrink-0">
                      <DirectionCard
                        direction={direction}
                        index={dirIdx}
                        isExpanded={false}
                        isSelected={false}
                        isDimmed={false}
                        onToggleExpand={() => {}}
                        onSelect={() =>
                          handleSelectFromRound(direction.id, round.generationJobId)
                        }
                        isSelectPending={selectDirection.isPending}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Current round (or recovering) */}
          {!isRecovering && directions.length > 0 && (
            <DirectionGrid
              directions={directions}
              briefText={briefText}
              selectedDirectionId={selectedDirectionId}
              onSelect={(directionId) => {
                selectDirection.mutate({ sessionId, directionId, generationJobId });
              }}
              isSelectPending={selectDirection.isPending}
              onRecovery={onRecovery}
            />
          )}

          {/* Recovery interface */}
          {isRecovering && (
            <div className="flex min-h-[calc(100dvh-48px)] flex-col items-center justify-center px-[var(--space-4)]">
              <div className="w-full max-w-[var(--content-narrow)]">
                <BriefDisplay text={briefText} />
              </div>
              <div className="mt-[var(--space-8)]">
                <RecoveryFlow
                  onSubmit={onRecoverySubmit}
                  isSubmitting={isRefining}
                  onPillSelected={(pill) => {
                    void trpcClient.feedback.captureEvent.mutate({
                      sessionId,
                      action: "suggestion_pill_selected",
                      payload: { pill },
                    });
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}

      <PaywallModal
        open={showPaywall}
        onClose={onPaywallClose}
        onUnlock={onPaywallUnlock}
        isLoading={isCheckoutLoading}
        error={checkoutError}
      />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function PaidPhase({
  sessionId,
  briefText,
  heroImageUrl,
  onImageGenerationStarted,
}: {
  sessionId: string;
  briefText: string;
  heroImageUrl: string | null;
  onImageGenerationStarted: (heroImageUrl: string | null) => void;
}) {
  const trpc = useTRPC();
  const imageGenTriggeredRef = useRef(false);

  // Poll until webhook confirms payment (isPaid: true), then trigger image gen
  const { data: packStatus } = useQuery(
    trpc.payment.getPackStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: (query) => {
          const isPaid = query.state.data?.isPaid;
          if (isPaid) return false;
          return 2000;
        },
      }
    )
  );

  const startImageGen = useMutation(
    trpc.generation.startImageGeneration.mutationOptions({
      onSuccess: () => {
        onImageGenerationStarted(heroImageUrl);
      },
    })
  );

  useEffect(() => {
    if (packStatus?.isPaid && !imageGenTriggeredRef.current) {
      imageGenTriggeredRef.current = true;
      startImageGen.mutate({ sessionId });
    }
  }, [packStatus?.isPaid, sessionId, startImageGen]);

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
      <p className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        Confirming payment...
      </p>
      <p className="mt-2 text-sm text-[var(--foreground-muted)]">
        {briefText ? briefText.slice(0, 80) : "Your release pack is being prepared"}
      </p>
    </div>
  );
}

function ImageGenerationPhase({
  sessionId,
  briefText,
  heroImageUrl,
  onSelectingReady,
  onError,
}: {
  sessionId: string;
  briefText: string;
  heroImageUrl: string | null;
  onSelectingReady: () => void;
  onError?: (message: string) => void;
}) {
  const trpc = useTRPC();
  const { timeoutLevel, reset: resetTimeout } = useGenerationStatus({
    phase: "generating_images",
  });

  const { data: statusData } = useQuery(
    trpc.generation.getImageGenerationStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (
            status === "selecting" ||
            status === "packaging" ||
            status === "delivered" ||
            status === "failed"
          ) {
            return false;
          }
          return 2500;
        },
      }
    )
  );

  const retryMutation = useMutation(
    trpc.generation.retry.mutationOptions({
      onSuccess: () => {
        resetTimeout();
      },
    })
  );

  // Transition to selecting phase when status changes
  useEffect(() => {
    if (statusData?.status === "selecting") {
      onSelectingReady();
    }
  }, [statusData?.status, onSelectingReady]);

  // Non-retryable failures
  useEffect(() => {
    if (statusData?.status === "failed" && statusData.canRetry === false && onError) {
      onError(
        statusData.failedStage === "content_policy"
          ? "We couldn't generate that image. Try adjusting your brief."
          : "Something went wrong."
      );
    }
  }, [statusData?.status, statusData?.canRetry, statusData?.failedStage, onError]);

  // Show inline error for retryable server failures
  if (statusData?.status === "failed" && statusData.canRetry) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <GenerationError
          message="Something went wrong. Try again?"
          canRetry
          onRetry={() => retryMutation.mutate({ sessionId })}
          briefText={briefText}
        />
      </div>
    );
  }

  const phrases = [
    "Generating within your direction...",
    "Evaluating composition and mood...",
    "Curating the strongest results...",
    "Refining the visual details...",
    "Aligning with your creative vision...",
  ];

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (timeoutLevel === "extended") return;

    const interval = setInterval(() => {
      if (prefersReducedMotion) {
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      } else {
        setIsVisible(false);
        setTimeout(() => {
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
          setIsVisible(true);
        }, 500);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [prefersReducedMotion, phrases.length, timeoutLevel]);

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
      {/* Blurred hero image background */}
      {heroImageUrl && (
        <div className="pointer-events-none fixed inset-0" style={{ opacity: 0.3 }}>
          <img
            src={heroImageUrl}
            alt=""
            className="h-full w-full object-cover blur-[40px]"
          />
        </div>
      )}

      {/* Fallback gradient when no hero image */}
      {!heroImageUrl && (
        <div className="pointer-events-none fixed inset-0 opacity-30">
          <div className="h-full w-full bg-gradient-to-br from-[#1a1a2e] via-[#09090b] to-[#16213e]" />
        </div>
      )}

      <div className="relative z-10 mx-auto w-full max-w-[var(--content-narrow)]">
        {/* Brief display */}
        <p className="text-sm text-[var(--foreground-muted)]">Your brief</p>
        <p className="mt-1 text-base text-[var(--foreground)]">{briefText}</p>

        {/* Status from server */}
        {statusData?.stepLabel && timeoutLevel === "normal" && (
          <p className="mt-4 text-xs text-[var(--foreground-subtle)]">
            {statusData.stepLabel}
          </p>
        )}

        {/* Narrative text */}
        <div aria-live="polite" className="mt-12 flex flex-col items-center">
          {timeoutLevel === "extended" ? (
            <>
              <p className="text-lg text-[var(--foreground)]">
                We hit a snag. Your brief is saved — try again?
              </p>
              <button
                type="button"
                onClick={() => retryMutation.mutate({ sessionId })}
                className="mt-6 rounded-md border border-[var(--foreground-subtle)] px-4 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              >
                Try again
              </button>
            </>
          ) : timeoutLevel === "delayed" ? (
            <p className="text-lg text-[var(--foreground)]">
              Taking a bit longer than usual...
            </p>
          ) : (
            <p
              className="text-lg text-[var(--foreground)]"
              style={{
                opacity: isVisible ? 1 : 0,
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity var(--duration-slow, 500ms) ease-in-out",
              }}
            >
              {phrases[phraseIndex]}
            </p>
          )}

          {/* Pulse element — only in normal/delayed */}
          {!prefersReducedMotion && timeoutLevel !== "extended" && (
            <div
              className="mt-8 h-2 w-2 rounded-full"
              style={{
                backgroundColor: "var(--foreground-subtle)",
                opacity: timeoutLevel === "delayed" ? 0.6 : 0.4,
                animation:
                  timeoutLevel === "delayed"
                    ? "delayedPulse 1s ease-in-out infinite"
                    : "pulse 1.5s ease-in-out infinite",
              }}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0.2; }
        }
        @keyframes delayedPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.8); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function PackagingPhase({
  sessionId,
  briefText,
  onDelivered,
}: {
  sessionId: string;
  briefText: string;
  onDelivered: () => void;
}) {
  const trpc = useTRPC();
  const { timeoutLevel, reset: resetTimeout } = useGenerationStatus({
    phase: "packaging",
  });

  const { data: statusData } = useQuery(
    trpc.generation.getImageGenerationStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (status === "delivered" || status === "failed") return false;
          return 2500;
        },
      }
    )
  );

  const retryMutation = useMutation(
    trpc.generation.retry.mutationOptions({
      onSuccess: () => {
        resetTimeout();
      },
    })
  );

  useEffect(() => {
    if (statusData?.status === "delivered") {
      onDelivered();
    }
  }, [statusData?.status, onDelivered]);

  // Show inline error for retryable server failures
  if (statusData?.status === "failed" && statusData.canRetry) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <GenerationError
          message="Something went wrong. Try again?"
          canRetry
          onRetry={() => retryMutation.mutate({ sessionId })}
          briefText={briefText}
        />
      </div>
    );
  }

  const phrases = [
    "Assembling your release package...",
    "Optimizing for every platform...",
    "Preparing your cover art...",
    "Generating platform formats...",
    "Almost ready...",
  ];

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (timeoutLevel === "extended") return;

    const interval = setInterval(() => {
      if (prefersReducedMotion) {
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      } else {
        setIsVisible(false);
        setTimeout(() => {
          setPhraseIndex((prev) => (prev + 1) % phrases.length);
          setIsVisible(true);
        }, 500);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [prefersReducedMotion, phrases.length, timeoutLevel]);

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
      <div className="relative z-10 mx-auto w-full max-w-[var(--content-narrow)]">
        <p className="text-sm text-[var(--foreground-muted)]">Your brief</p>
        <p className="mt-1 text-base text-[var(--foreground)]">{briefText}</p>

        {statusData?.stepLabel && timeoutLevel === "normal" && (
          <p className="mt-4 text-xs text-[var(--foreground-subtle)]">
            {statusData.stepLabel}
          </p>
        )}

        <div aria-live="polite" className="mt-12 flex flex-col items-center">
          {timeoutLevel === "extended" ? (
            <>
              <p className="text-lg text-[var(--foreground)]">
                We hit a snag. Your brief is saved — try again?
              </p>
              <button
                type="button"
                onClick={() => retryMutation.mutate({ sessionId })}
                className="mt-6 rounded-md border border-[var(--foreground-subtle)] px-4 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              >
                Try again
              </button>
            </>
          ) : timeoutLevel === "delayed" ? (
            <p className="text-lg text-[var(--foreground)]">
              Taking a bit longer than usual...
            </p>
          ) : (
            <p
              className="text-lg text-[var(--foreground)]"
              style={{
                opacity: isVisible ? 1 : 0,
                transition: prefersReducedMotion
                  ? "none"
                  : "opacity var(--duration-slow, 500ms) ease-in-out",
              }}
            >
              {phrases[phraseIndex]}
            </p>
          )}

          {!prefersReducedMotion && timeoutLevel !== "extended" && (
            <div
              className="mt-8 h-2 w-2 rounded-full"
              style={{
                backgroundColor: "var(--foreground-subtle)",
                opacity: timeoutLevel === "delayed" ? 0.6 : 0.4,
                animation:
                  timeoutLevel === "delayed"
                    ? "delayedPulse 1s ease-in-out infinite"
                    : "pulse 1.5s ease-in-out infinite",
              }}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 0.2; }
        }
        @keyframes delayedPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.8); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function SelectionPhase({
  sessionId,
  briefText,
  onPackagingStarted,
}: {
  sessionId: string;
  briefText: string;
  onPackagingStarted: () => void;
}) {
  const trpc = useTRPC();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: curatedData, refetch: refetchImages } = useQuery(
    trpc.generation.getCuratedImages.queryOptions({ sessionId })
  );

  const { data: packStatus, refetch: refetchPackStatus } = useQuery(
    trpc.payment.getPackStatus.queryOptions({ sessionId })
  );

  // Poll for status changes during regeneration
  const { data: statusData } = useQuery(
    trpc.generation.getImageGenerationStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: isRegenerating ? 2500 : false,
      }
    )
  );

  // When regeneration completes (status returns to selecting), refresh images
  useEffect(() => {
    if (isRegenerating && statusData?.status === "selecting") {
      setIsRegenerating(false);
      refetchImages();
      refetchPackStatus();
    }
  }, [isRegenerating, statusData?.status, refetchImages, refetchPackStatus]);

  const regenerateMutation = useMutation(
    trpc.generation.regenerate.mutationOptions({
      onSuccess: () => {
        void trpcClient.feedback.captureEvent.mutate({
          sessionId,
          action: "regeneration_requested",
          payload: { regenCount },
        });
        setIsRegenerating(true);
      },
      onError: () => {
        setIsRegenerating(false);
      },
    })
  );

  const confirmMutation = useMutation(
    trpc.generation.confirmSelection.mutationOptions({
      onSuccess: () => {
        toast.success("Selection confirmed", { duration: 3000 });
        onPackagingStarted();
      },
    })
  );

  const images = curatedData?.images ?? [];
  const canRegenerate = packStatus?.canRegenerate ?? false;
  const regenCount = packStatus?.regenCount ?? 0;
  const maxRegens = packStatus?.maxRegens ?? 3;

  return (
    <ImageSelection
      sessionId={sessionId}
      briefText={briefText}
      images={images}
      canRegenerate={canRegenerate}
      regenCount={regenCount}
      maxRegens={maxRegens}
      isRegenerating={isRegenerating || regenerateMutation.isPending}
      onRegenerate={() => regenerateMutation.mutate({ sessionId })}
      onConfirm={() => confirmMutation.mutate({ sessionId })}
      isConfirmPending={confirmMutation.isPending}
    />
  );
}
