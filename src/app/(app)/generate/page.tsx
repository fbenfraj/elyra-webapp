"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BriefInput } from "@/features/generation/components/BriefInput";
import { BriefDisplay } from "@/features/generation/components/BriefDisplay";
import { FollowUpQuestions } from "@/features/generation/components/FollowUpQuestions";
import { StatusPoller } from "@/features/generation/components/StatusPoller";
import { CreativeProcessLoader } from "@/features/generation/components/CreativeProcessLoader";
import { DirectionGrid } from "@/features/generation/components/DirectionGrid";
import { DirectionCard } from "@/features/generation/components/DirectionCard";
import { RecoveryFlow } from "@/features/generation/components/RecoveryFlow";
import type { Direction } from "@/lib/schemas/direction";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PaywallModal } from "@/features/payment/components/PaywallModal";

type DirectionRound = {
  generationJobId: string;
  directions: Direction[];
};

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
      selectedIndex: number;
      showPaywall: boolean;
    }
  | {
      phase: "paid";
      sessionId: string;
      briefText: string;
      directions: Direction[];
      generationJobId: string;
      selectedIndex: number;
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
      selectedIndex: 0,
    };
  }

  if (paymentStatus === "cancelled" && sessionId) {
    return {
      phase: "direction_selected",
      sessionId,
      briefText: "",
      directions: [],
      generationJobId: "",
      selectedIndex: 0,
      showPaywall: true,
    };
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
        if (!("sessionId" in state)) return;

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
        if ("sessionId" in state) {
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
      if (!("sessionId" in state)) return;
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
        selectedIndex={
          state.phase === "direction_selected" ? state.selectedIndex : null
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
        onSelected={(index, jobId) =>
          setState({
            phase: "direction_selected",
            sessionId: state.sessionId,
            briefText: state.briefText,
            directions: state.directions,
            generationJobId: jobId,
            selectedIndex: index,
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
      />
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
  onComplete: (directions: Direction[], generationJobId: string) => void;
  onError: (message: string) => void;
}) {
  const trpc = useTRPC();

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

  const { data: directionsData } = useQuery(
    trpc.generation.getDirections.queryOptions(
      { sessionId },
      { enabled: statusData?.status === "complete" }
    )
  );

  useEffect(() => {
    if (directionsData?.directions && directionsData?.generationJobId) {
      onComplete(directionsData.directions, directionsData.generationJobId);
    }
  }, [directionsData?.directions, directionsData?.generationJobId, onComplete]);

  useEffect(() => {
    if (statusData?.status === "failed") {
      onError(
        "Something went wrong generating your directions. Give it another try."
      );
    }
  }, [statusData?.status, onError]);

  return <CreativeProcessLoader briefText={briefText} />;
}

function DirectionRevealPhase({
  sessionId,
  briefText,
  directions,
  generationJobId,
  selectedIndex,
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
  selectedIndex: number | null;
  showPaywall: boolean;
  onSelected: (index: number, generationJobId: string) => void;
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
        onSelected(variables.directionIndex, variables.generationJobId ?? generationJobId);
      },
    })
  );

  const handleSelectFromRound = (
    directionIndex: number,
    roundJobId: string
  ) => {
    selectDirection.mutate({ sessionId, directionIndex, generationJobId: roundJobId });
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
                    onSelect={() => handleSelectFromRound(dirIdx, round.generationJobId)}
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
                        directionIndex: dirIdx,
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
                      onSelect={() => handleSelectFromRound(dirIdx, round.generationJobId)}
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
                          handleSelectFromRound(dirIdx, round.generationJobId)
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
              selectedIndex={selectedIndex}
              onSelect={(index) => {
                selectDirection.mutate({ sessionId, directionIndex: index, generationJobId });
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

function PaidPhase({ sessionId }: { sessionId: string }) {
  const trpc = useTRPC();

  // Poll until webhook confirms payment (isPaid: true), then stop
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

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
      <p className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        Generation starting...
      </p>
      <p className="mt-2 text-sm text-[var(--foreground-muted)]">
        Your release pack is being prepared
      </p>
      {packStatus?.isPaid && (
        <div className="mt-6 text-center">
          {packStatus.canRegenerate ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              {packStatus.maxRegens - packStatus.regenCount} regeneration{packStatus.maxRegens - packStatus.regenCount !== 1 ? "s" : ""} remaining
            </p>
          ) : (
            <p className="text-sm text-[var(--foreground-muted)]">
              These are your strongest options
            </p>
          )}
        </div>
      )}
    </div>
  );
}
