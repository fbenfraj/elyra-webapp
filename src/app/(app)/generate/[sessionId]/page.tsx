"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BriefDisplay } from "@/features/generation/components/BriefDisplay";
import { FollowUpQuestions } from "@/features/generation/components/FollowUpQuestions";
import { StatusPoller } from "@/features/generation/components/StatusPoller";
import { CreativeProcessLoader } from "@/features/generation/components/CreativeProcessLoader";
import { GenerationError } from "@/features/generation/components/GenerationError";
import {
  GenerationWaiting,
  PulseRings,
  CyclingStatus,
} from "@/features/generation/components/GenerationWaiting";
import { useGenerationStatus } from "@/features/generation/lib/use-generation-status";
import { DirectionGrid } from "@/features/generation/components/DirectionGrid";
import { DirectionCard } from "@/features/generation/components/DirectionCard";
import { RecoveryFlow } from "@/features/generation/components/RecoveryFlow";
import type { Direction } from "@/lib/schemas/direction";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PaywallModal } from "@/features/payment/components/PaywallModal";
import { ImageSelection } from "@/features/generation/components/ImageSelection";
import { PackageReveal } from "@/features/generation/components/PackageReveal";
import { trpcClient } from "@/lib/trpc/client";

type DirectionRound = {
  generationJobId: string;
  directions: Direction[];
};

type WorkspaceState =
  | { phase: "loading" }
  | { phase: "not_found" }
  | { phase: "processing"; briefText: string }
  | {
      phase: "follow_up";
      briefText: string;
      questions: string[];
    }
  | {
      phase: "generating_directions";
      briefText: string;
    }
  | {
      phase: "directions_ready";
      briefText: string;
      directions: Direction[];
      generationJobId: string;
    }
  | {
      phase: "recovering";
      briefText: string;
      directions: Direction[];
      generationJobId: string;
    }
  | {
      phase: "direction_selected";
      briefText: string;
      directions: Direction[];
      generationJobId: string;
      selectedDirectionId: string;
      showPaywall: boolean;
    }
  | {
      phase: "paid";
      briefText: string;
      directions: Direction[];
      generationJobId: string;
      selectedDirectionId: string;
    }
  | {
      phase: "generating_images";
      briefText: string;
      heroImageUrl: string | null;
    }
  | {
      phase: "selecting";
      briefText: string;
    }
  | {
      phase: "packaging";
      briefText: string;
    }
  | {
      phase: "delivered";
      briefText: string;
      assetType: string;
      userBrief: string | null;
    }
  | { phase: "error"; briefText: string; message: string };

export default function GenerateWorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const [state, setState] = useState<WorkspaceState>({ phase: "loading" });
  const [previousRounds, setPreviousRounds] = useState<DirectionRound[]>([]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const trpc = useTRPC();

  // --- Mutations ---

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
            briefText: state.briefText,
            questions: result.output.questions,
          });
          return;
        }

        setState({
          phase: "generating_directions",
          briefText: state.briefText,
        });
        startDirections.mutate({ sessionId });
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
        if (state.phase === "loading" || state.phase === "not_found" || state.phase === "error") return;

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
            briefText: state.briefText,
            questions: result.output.questions,
          });
          return;
        }

        setState({
          phase: "generating_directions",
          briefText: state.briefText,
        });
        startDirections.mutate({ sessionId });
      },
      onError: () => {
        if (state.phase !== "loading" && state.phase !== "not_found" && state.phase !== "error") {
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

  const editBrief = useMutation(
    trpc.generation.editBrief.mutationOptions({
      onSuccess: (result) => {
        if (!result.ok) {
          setState({
            phase: "error",
            briefText: state.phase !== "loading" && state.phase !== "not_found" ? state.briefText : "",
            message:
              result.error?.message ??
              "Something went wrong editing your brief. Give it another try.",
          });
          return;
        }

        const newBriefText = editBrief.variables?.newBriefText ?? (state.phase !== "loading" && state.phase !== "not_found" ? state.briefText : "");

        if (result.output?.type === "follow_up") {
          setState({
            phase: "follow_up",
            briefText: newBriefText,
            questions: result.output.questions,
          });
          return;
        }

        // Interpretation succeeded — move to direction generation
        setState({
          phase: "generating_directions",
          briefText: newBriefText,
        });
        startDirections.mutate({ sessionId });
      },
      onError: () => {
        setState({
          phase: "error",
          briefText: state.phase !== "loading" && state.phase !== "not_found" ? state.briefText : "",
          message:
            "Something went wrong editing your brief. Give it another try.",
        });
      },
    })
  );

  const changeDirectionPostPayment = useMutation(
    trpc.generation.changeDirectionPostPayment.mutationOptions({
      onSuccess: () => {
        toast.success("Direction changed successfully", { duration: 3000 });
        // Re-trigger image generation with new direction
        setState((prev) => {
          if (prev.phase !== "paid" && prev.phase !== "direction_selected") return prev;
          return {
            phase: "paid",
            briefText: prev.briefText,
            directions: prev.directions,
            generationJobId: prev.generationJobId,
            selectedDirectionId: changeDirectionPostPayment.variables?.directionId ?? prev.selectedDirectionId,
          };
        });
      },
      onError: () => {
        toast.error("Could not change direction. Please try again.");
      },
    })
  );

  // Determine if brief can be edited based on current phase
  const canEditBrief =
    state.phase === "generating_directions" ||
    state.phase === "directions_ready" ||
    state.phase === "direction_selected" ||
    state.phase === "recovering";

  const handleEditBrief = useCallback(
    (newText: string) => {
      editBrief.mutate({ sessionId, newBriefText: newText });
    },
    [sessionId, editBrief]
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
    if (paymentParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams]);

  // Rehydrate session on mount (ref guard prevents React strict mode double-fire)
  const rehydratedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== "loading") return;
    if (rehydratedRef.current) return;
    rehydratedRef.current = true;

    async function rehydrate() {
      try {
        // Check if returning from payment
        const paymentParam = searchParams.get("payment");

        const session = await trpcClient.generation.getFullSession.query({ sessionId });
        const briefText = session.briefText ?? "";
        const status = session.status as string;

        // If returning from successful payment, go to paid phase
        if (paymentParam === "success") {
          setState({
            phase: "paid",
            briefText,
            directions: session.directions ?? [],
            generationJobId: session.generationJobId ?? "",
            selectedDirectionId: session.selectedDirectionId ?? "",
          });
          return;
        }

        // If payment was cancelled, show paywall again
        if (paymentParam === "cancelled" && session.selectedDirectionId) {
          setState({
            phase: "direction_selected",
            briefText,
            directions: session.directions ?? [],
            generationJobId: session.generationJobId ?? "",
            selectedDirectionId: session.selectedDirectionId,
            showPaywall: true,
          });
          return;
        }

        // Map DB status to workspace phase
        if (status === "pending") {
          // Freshly created session — kick off interpretation
          setState({ phase: "processing", briefText });
          try {
            const startResult = await trpcClient.generation.start.mutate({ sessionId });
            if (startResult.ok && startResult.output?.type === "follow_up") {
              setState({
                phase: "follow_up",
                briefText,
                questions: startResult.output.questions,
              });
              return;
            }
            if (!startResult.ok) {
              setState({
                phase: "error",
                briefText,
                message: startResult.error?.message ?? "Something went wrong interpreting your brief.",
              });
              return;
            }
            // Interpretation succeeded — kick off direction generation
            setState({ phase: "generating_directions", briefText });
            await trpcClient.generation.startDirections.mutate({ sessionId });
          } catch {
            // If start/startDirections fails, show error
            setState({
              phase: "error",
              briefText,
              message: "Something went wrong starting your session. Give it another try.",
            });
          }
        } else if (status === "interpreting") {
          setState({ phase: "processing", briefText });
        } else if (status === "generating_directions") {
          setState({ phase: "generating_directions", briefText });
        } else if (status === "selecting" || status === "complete") {
          if (session.directions && session.generationJobId) {
            setState({
              phase: "directions_ready",
              briefText,
              directions: session.directions,
              generationJobId: session.generationJobId,
            });
          } else {
            setState({ phase: "generating_directions", briefText });
          }
        } else if (status === "direction_selected") {
          setState({
            phase: "direction_selected",
            briefText,
            directions: session.directions ?? [],
            generationJobId: session.generationJobId ?? "",
            selectedDirectionId: session.selectedDirectionId ?? "",
            showPaywall: true,
          });
        } else if (status === "paid") {
          setState({
            phase: "paid",
            briefText,
            directions: session.directions ?? [],
            generationJobId: session.generationJobId ?? "",
            selectedDirectionId: session.selectedDirectionId ?? "",
          });
        } else if (status === "generating_images" || status === "evaluating") {
          setState({
            phase: "generating_images",
            briefText,
            heroImageUrl: null,
          });
        } else if (status === "selecting") {
          setState({ phase: "selecting", briefText });
        } else if (status === "packaging") {
          setState({ phase: "packaging", briefText });
        } else if (status === "delivered") {
          setState({
            phase: "delivered",
            briefText,
            assetType: session.assetType ?? "release_artwork",
            userBrief: session.userBrief ?? null,
          });
        } else if (status === "failed") {
          setState({
            phase: "error",
            briefText,
            message: session.canRetry
              ? "Something went wrong. You can try again."
              : "This session failed. You can start a new one.",
          });
        } else {
          setState({ phase: "not_found" });
        }
      } catch {
        setState({ phase: "not_found" });
      }
    }

    rehydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Track screen enter/exit
  useEffect(() => {
    if (state.phase === "loading" || state.phase === "not_found") return;
    void trpcClient.feedback.captureEvent.mutate({
      sessionId,
      action: "screen_entered",
      payload: { screen: state.phase },
    });
    const enteredAt = Date.now();
    return () => {
      void trpcClient.feedback.captureEvent.mutate({
        sessionId,
        action: "screen_exited",
        payload: { screen: state.phase, durationMs: Date.now() - enteredAt },
      });
    };
  }, [state.phase, sessionId]);

  const handleDirectionsComplete = useCallback(
    (directions: Direction[], generationJobId: string) => {
      setState((prev) => {
        if (prev.phase !== "generating_directions") return prev;
        return {
          phase: "directions_ready",
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
        sessionId,
        action: "recovery_started",
      });
      setPreviousRounds((rounds) => [
        ...rounds,
        { generationJobId: prev.generationJobId, directions: prev.directions },
      ]);
      return {
        phase: "recovering",
        briefText: prev.briefText,
        directions: prev.directions,
        generationJobId: prev.generationJobId,
      };
    });
  }, [sessionId]);

  const handleRecoverySubmit = useCallback(
    (data: { selectedPills: string[]; refinementText: string }) => {
      if (state.phase === "loading" || state.phase === "not_found" || state.phase === "error") return;
      void trpcClient.feedback.captureEvent.mutate({
        sessionId,
        action: "brief_refined",
        payload: {
          selectedPills: data.selectedPills,
          hasRefinementText: data.refinementText.length > 0,
        },
      });
      setState({
        phase: "processing",
        briefText: state.briefText,
      });
      refineGeneration.mutate({
        sessionId,
        selectedPills: data.selectedPills,
        refinementText: data.refinementText,
      });
    },
    [state, sessionId, refineGeneration]
  );

  const isGalleryMode = previousRounds.length >= 3;

  // --- Render ---

  if (state.phase === "loading") {
    return (
      <GenerationWaiting briefText="Loading your session...">
        <PulseRings />
      </GenerationWaiting>
    );
  }

  if (state.phase === "not_found") {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center gap-4">
        <p className="text-lg text-[var(--foreground)]">Session not found</p>
        <Link
          href="/generate"
          className="text-sm text-[var(--foreground-muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
        >
          Start a new session
        </Link>
      </div>
    );
  }

  if (state.phase === "follow_up") {
    return (
      <GenerationWaiting
        briefText={state.briefText}
        canEditBrief={canEditBrief}
        onEditBrief={handleEditBrief}
        isEditingBrief={editBrief.isPending}
      >
        <FollowUpQuestions
          questions={state.questions}
          onSubmit={(response) => {
            setState({
              phase: "processing",
              briefText: `${state.briefText}\n\n${response}`,
            });
            startInterpretation.mutate({ sessionId });
          }}
          isSubmitting={startInterpretation.isPending}
        />
      </GenerationWaiting>
    );
  }

  if (state.phase === "processing") {
    return (
      <ProcessingPollingPhase
        sessionId={sessionId}
        briefText={state.briefText}
        canEditBrief={canEditBrief}
        onEditBrief={handleEditBrief}
        isEditingBrief={editBrief.isPending}
        onGeneratingDirections={() => {
          setState({
            phase: "generating_directions",
            briefText: state.briefText,
          });
          startDirections.mutate({ sessionId });
        }}
        onFollowUp={(questions) => {
          setState({
            phase: "follow_up",
            briefText: state.briefText,
            questions,
          });
        }}
        onError={(message) => {
          setState({
            phase: "error",
            briefText: state.briefText,
            message,
          });
        }}
      />
    );
  }

  if (state.phase === "generating_directions") {
    return (
      <DirectionPollingPhase
        sessionId={sessionId}
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
        sessionId={sessionId}
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
            setState({
              phase: "directions_ready",
              briefText: state.briefText,
              directions: state.directions,
              generationJobId: state.generationJobId,
            });
          }
        }}
        onPaywallUnlock={() => {
          setCheckoutError(null);
          createCheckout.mutate({ sessionId });
        }}
        checkoutError={checkoutError}
        isCheckoutLoading={createCheckout.isPending}
        onSelected={(directionId, jobId) =>
          setState({
            phase: "direction_selected",
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
        canEditBrief={canEditBrief}
        onEditBrief={handleEditBrief}
        isEditingBrief={editBrief.isPending}
      />
    );
  }

  if (state.phase === "paid") {
    return (
      <PaidPhase
        sessionId={sessionId}
        briefText={state.briefText}
        heroImageUrl={
          state.directions.find((d) => d.id === state.selectedDirectionId)?.heroImageUrl ?? null
        }
        onImageGenerationStarted={(heroImageUrl) =>
          setState({
            phase: "generating_images",
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
        sessionId={sessionId}
        briefText={state.briefText}
        heroImageUrl={state.heroImageUrl}
        onSelectingReady={() =>
          setState({
            phase: "selecting",
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
        sessionId={sessionId}
        briefText={state.briefText}
        onPackagingStarted={() =>
          setState({
            phase: "packaging",
            briefText: state.briefText,
          })
        }
      />
    );
  }

  if (state.phase === "packaging") {
    return (
      <PackagingPhase
        sessionId={sessionId}
        briefText={state.briefText}
        onDelivered={(assetType, userBrief) =>
          setState({
            phase: "delivered",
            briefText: state.briefText,
            assetType,
            userBrief,
          })
        }
      />
    );
  }

  if (state.phase === "delivered") {
    return (
      <PackageReveal
        sessionId={sessionId}
        briefText={state.briefText}
        assetType={state.assetType}
        userBrief={state.userBrief}
      />
    );
  }

  if (state.phase === "error") {
    const isContentPolicy = state.message.includes("Try adjusting your brief");
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <GenerationError
          message={state.message}
          canRetry={!isContentPolicy}
          onRetry={() => {
            setState({ phase: "loading" });
          }}
          showEditBrief={isContentPolicy}
          onEditBrief={() => {
            setState({ phase: "loading" });
          }}
          briefText={state.briefText}
        />
      </div>
    );
  }

  // Fallback — should not reach here
  return null;
}

// --- Sub-phase components ---

/**
 * Polls getStatus during the processing/interpreting phase.
 * Detects when interpretation completes and transitions to the next phase.
 * This is needed for refresh resilience — when a user refreshes during
 * interpreting, the Trigger.dev task is already running and will complete,
 * but the UI needs to detect the status change.
 */
function ProcessingPollingPhase({
  sessionId,
  briefText,
  canEditBrief,
  onEditBrief,
  isEditingBrief,
  onGeneratingDirections,
  onFollowUp,
  onError,
}: {
  sessionId: string;
  briefText: string;
  canEditBrief: boolean;
  onEditBrief: (newText: string) => void;
  isEditingBrief: boolean;
  onGeneratingDirections: () => void;
  onFollowUp: (questions: string[]) => void;
  onError: (message: string) => void;
}) {
  const trpc = useTRPC();

  const { data: statusData } = useQuery(
    trpc.generation.getStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (
            status === "generating_directions" ||
            status === "selecting" ||
            status === "complete" ||
            status === "failed"
          ) {
            return false;
          }
          return 3000;
        },
      }
    )
  );

  useEffect(() => {
    if (!statusData) return;
    if (statusData.status === "generating_directions") {
      onGeneratingDirections();
    } else if (statusData.status === "failed") {
      onError(
        statusData.failedStage === "content_policy"
          ? "We couldn't process that brief. Try adjusting your brief."
          : "Something went wrong interpreting your brief."
      );
    }
  }, [statusData?.status, statusData?.failedStage, onGeneratingDirections, onError]);

  return (
    <GenerationWaiting
      briefText={briefText}
      canEditBrief={canEditBrief}
      onEditBrief={onEditBrief}
      isEditingBrief={isEditingBrief}
    >
      <StatusPoller sessionId={sessionId} />
      <PulseRings />
    </GenerationWaiting>
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
      onError(
        statusData.failedStage === "content_policy"
          ? "We couldn't generate that image. Try adjusting your brief."
          : "Something went wrong generating your directions."
      );
    }
  }, [statusData?.status, statusData?.canRetry, statusData?.failedStage, onError]);

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
  canEditBrief,
  onEditBrief,
  isEditingBrief,
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
  canEditBrief?: boolean;
  onEditBrief?: (newText: string) => void;
  isEditingBrief?: boolean;
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
    <GenerationWaiting briefText={briefText || "Your release pack is being prepared"}>
      <p className="text-lg text-[var(--foreground)]">Confirming payment...</p>
      <PulseRings />
    </GenerationWaiting>
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

  useEffect(() => {
    if (statusData?.status === "selecting") {
      onSelectingReady();
    }
  }, [statusData?.status, onSelectingReady]);

  useEffect(() => {
    if (statusData?.status === "failed" && statusData.canRetry === false && onError) {
      onError(
        statusData.failedStage === "content_policy"
          ? "We couldn't generate that image. Try adjusting your brief."
          : "Something went wrong."
      );
    }
  }, [statusData?.status, statusData?.canRetry, statusData?.failedStage, onError]);

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

  const IMAGE_PHRASES = [
    "Generating within your direction...",
    "Evaluating composition and mood...",
    "Curating the strongest results...",
    "Refining the visual details...",
    "Aligning with your creative vision...",
  ];

  return (
    <GenerationWaiting briefText={briefText}>
      {statusData?.stepLabel && timeoutLevel === "normal" && (
        <p className="text-xs text-[var(--foreground-subtle)]">
          {statusData.stepLabel}
        </p>
      )}

      {timeoutLevel === "extended" ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg text-[var(--foreground)]">
            We hit a snag. Your brief is saved — try again?
          </p>
          <button
            type="button"
            onClick={() => retryMutation.mutate({ sessionId })}
            className="rounded-[var(--radius-sm)] border border-[var(--foreground-subtle)] px-5 py-2.5 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            Try again
          </button>
        </div>
      ) : timeoutLevel === "delayed" ? (
        <div className="flex flex-col items-center gap-6">
          <p className="text-lg text-[var(--foreground)]">
            Taking a bit longer than usual...
          </p>
          <PulseRings />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8">
          <CyclingStatus phrases={IMAGE_PHRASES} />
          <PulseRings />
        </div>
      )}
    </GenerationWaiting>
  );
}

function PackagingPhase({
  sessionId,
  briefText,
  onDelivered,
}: {
  sessionId: string;
  briefText: string;
  onDelivered: (assetType: string, userBrief: string | null) => void;
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

  const { data: fullSession } = useQuery(
    trpc.generation.getFullSession.queryOptions(
      { sessionId },
      { enabled: statusData?.status === "delivered" }
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
    if (statusData?.status === "delivered" && fullSession) {
      onDelivered(fullSession.assetType ?? "release_artwork", fullSession.userBrief ?? null);
    }
  }, [statusData?.status, fullSession, onDelivered]);

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

  const PACKAGING_PHRASES = [
    "Assembling your release package...",
    "Optimizing for every platform...",
    "Preparing your cover art...",
    "Generating platform formats...",
    "Almost ready...",
  ];

  return (
    <GenerationWaiting briefText={briefText}>
      {statusData?.stepLabel && timeoutLevel === "normal" && (
        <p className="text-xs text-[var(--foreground-subtle)]">
          {statusData.stepLabel}
        </p>
      )}

      {timeoutLevel === "extended" ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg text-[var(--foreground)]">
            We hit a snag. Your brief is saved — try again?
          </p>
          <button
            type="button"
            onClick={() => retryMutation.mutate({ sessionId })}
            className="rounded-[var(--radius-sm)] border border-[var(--foreground-subtle)] px-5 py-2.5 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            Try again
          </button>
        </div>
      ) : timeoutLevel === "delayed" ? (
        <div className="flex flex-col items-center gap-6">
          <p className="text-lg text-[var(--foreground)]">
            Taking a bit longer than usual...
          </p>
          <PulseRings />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8">
          <CyclingStatus phrases={PACKAGING_PHRASES} />
          <PulseRings />
        </div>
      )}
    </GenerationWaiting>
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
  // Tracks that a regeneration was asked for. Whether one is still RUNNING is
  // the server's answer, not ours, so it is derived below rather than cleared
  // from an effect: the old version set state inside the poll handler, which
  // cost a second render on every completion.
  const [regenRequested, setRegenRequested] = useState(false);

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
        // Polling stops on the polled value itself, so no local flag has to be
        // cleared to end it.
        refetchInterval: (query) =>
          regenRequested && query.state.data?.status !== "selecting" ? 2500 : false,
      }
    )
  );

  const isRegenerating = regenRequested && statusData?.status !== "selecting";

  // When regeneration completes (status returns to selecting), refresh images.
  useEffect(() => {
    if (regenRequested && statusData?.status === "selecting") {
      refetchImages();
      refetchPackStatus();
    }
  }, [regenRequested, statusData?.status, refetchImages, refetchPackStatus]);

  const regenerateMutation = useMutation(
    trpc.generation.regenerate.mutationOptions({
      onSuccess: () => {
        void trpcClient.feedback.captureEvent.mutate({
          sessionId,
          action: "regeneration_requested",
          payload: { regenCount },
        });
        setRegenRequested(true);
      },
      onError: () => {
        setRegenRequested(false);
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
