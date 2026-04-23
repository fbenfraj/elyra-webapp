"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { RUBRIC_WEIGHTS } from "@/config/evaluation";
import { ALERT_THRESHOLDS } from "@/config/limits";

type DatePreset = "24h" | "7d" | "30d";
type Tab = "metrics" | "sessions" | "calibration" | "providers";

function getDateRange(preset: DatePreset) {
  const to = new Date();
  const from = new Date();
  switch (preset) {
    case "24h":
      from.setHours(from.getHours() - 24);
      break;
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
  }
  return { from, to };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
        {value}
      </p>
      {detail && (
        <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
          {detail}
        </p>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4">
      <div className="h-3 w-20 animate-pulse rounded bg-[var(--background-overlay)]" />
      <div className="mt-2 h-7 w-24 animate-pulse rounded bg-[var(--background-overlay)]" />
    </div>
  );
}

function ThresholdBadge({
  label,
  value,
  threshold,
  mode,
}: {
  label: string;
  value: number;
  threshold: number;
  mode: "min" | "max";
}) {
  const isHealthy =
    mode === "min" ? value >= threshold : value <= threshold;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          isHealthy ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <span className="text-sm text-[var(--foreground)]">{label}</span>
      <span className="text-xs text-[var(--foreground-muted)]">
        {value.toFixed(1)} / {mode === "min" ? ">=" : "<="} {threshold}
      </span>
    </div>
  );
}

type SessionFilters = {
  zeroHitRate: boolean;
  lowScores: boolean;
  highRetries: boolean;
  vagueBriefs: boolean;
};

function FilterToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--foreground)] text-[var(--background)]"
          : "bg-[var(--background-overlay)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );
}

const CIRCUIT_STATE_STYLES: Record<string, { label: string; className: string }> = {
  closed: { label: "Closed", className: "bg-green-500/20 text-green-400" },
  "half-open": { label: "Half-Open", className: "bg-yellow-500/20 text-yellow-400" },
  open: { label: "Open", className: "bg-red-500/20 text-red-400" },
};

const PROVIDER_LABELS: Record<string, string> = {
  fal: "fal.ai",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

function ProviderStatusCard({
  provider,
}: {
  provider: {
    provider: string;
    health: { status: string; lastChecked: Date; latencyMs: number | null; errorCount: number };
    circuitBreakerState: {
      state: string;
      failureCount: number;
      lastFailureTime: number | null;
      lastSuccessTime: number | null;
      openedAt: number | null;
    };
  };
}) {
  const cbState = CIRCUIT_STATE_STYLES[provider.circuitBreakerState.state] ?? CIRCUIT_STATE_STYLES.closed;
  const displayName = PROVIDER_LABELS[provider.provider] ?? provider.provider;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">{displayName}</p>
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cbState.className}`}>
          {cbState.label}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">Status</span>
          <span className="text-xs font-medium text-[var(--foreground)]">{provider.health.status}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">Recent Failures</span>
          <span className={`text-xs font-medium ${provider.circuitBreakerState.failureCount > 0 ? "text-red-400" : "text-[var(--foreground)]"}`}>
            {provider.circuitBreakerState.failureCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">Latency</span>
          <span className="text-xs font-medium text-[var(--foreground)]">
            {provider.health.latencyMs != null ? formatMs(provider.health.latencyMs) : "--"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">Last Success</span>
          <span className="text-xs text-[var(--foreground-muted)]">
            {provider.circuitBreakerState.lastSuccessTime
              ? new Date(provider.circuitBreakerState.lastSuccessTime).toLocaleString()
              : "--"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--foreground-muted)]">Last Failure</span>
          <span className="text-xs text-[var(--foreground-muted)]">
            {provider.circuitBreakerState.lastFailureTime
              ? new Date(provider.circuitBreakerState.lastFailureTime).toLocaleString()
              : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OperatorPage() {
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [activeTab, setActiveTab] = useState<Tab>("metrics");
  const [sessionFilters, setSessionFilters] = useState<SessionFilters>({
    zeroHitRate: false,
    lowScores: false,
    highRetries: false,
    vagueBriefs: false,
  });

  const trpc = useTRPC();
  const range = getDateRange(preset);

  const {
    data: pipelineMetrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery(
    trpc.operator.getPipelineMetrics.queryOptions({
      from: range.from,
      to: range.to,
    })
  );

  const {
    data: sessionCosts,
    isLoading: costsLoading,
    error: costsError,
  } = useQuery(
    trpc.operator.getSessionCosts.queryOptions({
      from: range.from,
      to: range.to,
    })
  );

  const {
    data: providerHealthData,
    isLoading: providerHealthLoading,
    error: providerHealthError,
  } = useQuery(trpc.operator.getProviderHealth.queryOptions());

  const hasAnyFilter = Object.values(sessionFilters).some(Boolean);

  const {
    data: problematicSessions,
    isLoading: problematicLoading,
    error: problematicError,
  } = useQuery(
    trpc.operator.getProblematicSessions.queryOptions({
      filters: sessionFilters,
      from: range.from,
      to: range.to,
    })
  );

  const error = metricsError || costsError || problematicError || providerHealthError;

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        {error.message === "Operator access required"
          ? "You do not have operator access."
          : `Error loading metrics: ${error.message}`}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="flex gap-1 rounded-lg bg-[var(--background-overlay)] p-1">
        {(
          [
            { id: "metrics", label: "Metrics" },
            { id: "sessions", label: "Sessions" },
            { id: "calibration", label: "Calibration" },
            { id: "providers", label: "Providers" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date range selector */}
      <div className="flex gap-2">
        {(["24h", "7d", "30d"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              preset === p
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "bg-[var(--background-overlay)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ===== METRICS TAB ===== */}
      {activeTab === "metrics" && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {metricsLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : pipelineMetrics ? (
              <>
                <MetricCard
                  label="Hit Rate"
                  value={formatPercent(pipelineMetrics.hitRate)}
                  detail="Selected + passing"
                />
                <MetricCard
                  label="1st Attempt Success"
                  value={formatPercent(
                    pipelineMetrics.successRate.firstAttempt
                  )}
                  detail={`Overall: ${formatPercent(pipelineMetrics.successRate.overall)}`}
                />
                <MetricCard
                  label="Avg Cost / Deliverable"
                  value={formatCents(pipelineMetrics.avgCost)}
                />
                <MetricCard
                  label="Avg Latency"
                  value={formatMs(pipelineMetrics.avgLatency)}
                  detail="End-to-end"
                />
              </>
            ) : null}
          </div>

          {/* Threshold status */}
          {pipelineMetrics && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                Threshold Status
              </p>
              <div className="flex flex-wrap gap-4">
                <ThresholdBadge
                  label="Hit Rate"
                  value={pipelineMetrics.hitRate}
                  threshold={ALERT_THRESHOLDS.minHitRatePercent}
                  mode="min"
                />
                <ThresholdBadge
                  label="Avg Cost"
                  value={pipelineMetrics.avgCost}
                  threshold={ALERT_THRESHOLDS.maxAvgCostCentsPerDeliverable}
                  mode="max"
                />
              </div>
            </div>
          )}

          {/* Eval score distribution */}
          {pipelineMetrics && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                Evaluation Score Distribution
              </p>
              <div className="flex gap-3">
                {Object.entries(pipelineMetrics.evalDistribution).map(
                  ([bucket, count]) => (
                    <div key={bucket} className="flex-1 text-center">
                      <p className="text-lg font-semibold text-[var(--foreground)]">
                        {count}
                      </p>
                      <p className="text-xs text-[var(--foreground-muted)]">
                        {bucket}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Session costs table */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                Recent Sessions
              </p>
            </div>
            {costsLoading ? (
              <div className="p-4">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded bg-[var(--background-overlay)]"
                    />
                  ))}
                </div>
              </div>
            ) : sessionCosts && sessionCosts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--foreground-muted)]">
                      <th className="px-4 py-2 font-medium">Brief</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium text-right">
                        Cost
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Attempts
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Avg Score
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionCosts.map((session) => {
                      const costCents = Number(
                        session.total_cost_cents ?? 0
                      );
                      const isOutlier = costCents > 100;
                      return (
                        <tr
                          key={String(session.id)}
                          className="border-b border-[var(--border)] last:border-0"
                        >
                          <td className="max-w-[200px] truncate px-4 py-2 text-[var(--foreground)]">
                            {String(session.brief_text ?? "—")}
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--foreground-muted)]">
                              {String(session.status ?? "—")}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-mono ${
                              isOutlier
                                ? "font-semibold text-red-400"
                                : "text-[var(--foreground)]"
                            }`}
                          >
                            {formatCents(costCents)}
                          </td>
                          <td className="px-4 py-2 text-right text-[var(--foreground)]">
                            {String(session.attempt_count ?? 0)}
                          </td>
                          <td className="px-4 py-2 text-right text-[var(--foreground)]">
                            {session.avg_eval_score != null
                              ? Number(session.avg_eval_score).toFixed(2)
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-[var(--foreground-muted)]">
                            {session.created_at
                              ? new Date(
                                  String(session.created_at)
                                ).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-[var(--foreground-muted)]">
                No sessions found for this period.
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== SESSIONS TAB ===== */}
      {activeTab === "sessions" && (
        <>
          {/* Filter toggles */}
          <div className="flex flex-wrap gap-2">
            <FilterToggle
              label="Zero hit rate"
              active={sessionFilters.zeroHitRate}
              onClick={() =>
                setSessionFilters((f) => ({
                  ...f,
                  zeroHitRate: !f.zeroHitRate,
                }))
              }
            />
            <FilterToggle
              label="Low scores"
              active={sessionFilters.lowScores}
              onClick={() =>
                setSessionFilters((f) => ({
                  ...f,
                  lowScores: !f.lowScores,
                }))
              }
            />
            <FilterToggle
              label="High retries"
              active={sessionFilters.highRetries}
              onClick={() =>
                setSessionFilters((f) => ({
                  ...f,
                  highRetries: !f.highRetries,
                }))
              }
            />
            <FilterToggle
              label="Vague briefs"
              active={sessionFilters.vagueBriefs}
              onClick={() =>
                setSessionFilters((f) => ({
                  ...f,
                  vagueBriefs: !f.vagueBriefs,
                }))
              }
            />
          </div>

          {!hasAnyFilter && (
            <p className="text-sm text-[var(--foreground-muted)]">
              Select at least one filter to find problematic sessions.
            </p>
          )}

          {/* Problematic sessions table */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                Problematic Sessions
              </p>
            </div>
            {problematicLoading ? (
              <div className="p-4">
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 animate-pulse rounded bg-[var(--background-overlay)]"
                    />
                  ))}
                </div>
              </div>
            ) : problematicSessions && problematicSessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--foreground-muted)]">
                      <th className="px-4 py-2 font-medium">Brief</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium text-right">
                        Cost
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Attempts
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Avg Score
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {problematicSessions.map((session) => {
                      const costCents = Number(
                        session.total_cost_cents ?? 0
                      );
                      const avgScore =
                        session.avg_eval_score != null
                          ? Number(session.avg_eval_score)
                          : null;
                      const isZeroHit = avgScore === null || avgScore < 0.7;
                      const briefText = String(session.brief_text ?? "—");
                      const truncatedBrief =
                        briefText.length > 60
                          ? briefText.slice(0, 60) + "..."
                          : briefText;

                      return (
                        <tr
                          key={String(session.id)}
                          className="border-b border-[var(--border)] last:border-0"
                        >
                          <td
                            className={`max-w-[200px] truncate px-4 py-2 ${
                              isZeroHit
                                ? "text-[var(--destructive)]"
                                : "text-[var(--foreground)]"
                            }`}
                            title={briefText}
                          >
                            {truncatedBrief}
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--foreground-muted)]">
                              {String(session.status ?? "—")}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--foreground)]">
                            {formatCents(costCents)}
                          </td>
                          <td className="px-4 py-2 text-right text-[var(--foreground)]">
                            {String(session.attempt_count ?? 0)}
                          </td>
                          <td className="px-4 py-2 text-right text-[var(--foreground)]">
                            {avgScore != null ? avgScore.toFixed(2) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-[var(--foreground-muted)]">
                            {session.created_at
                              ? new Date(
                                  String(session.created_at)
                                ).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-[var(--foreground-muted)]">
                {hasAnyFilter
                  ? "No problematic sessions found for the selected filters."
                  : "Select filters above to search for problematic sessions."}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== CALIBRATION TAB ===== */}
      {activeTab === "calibration" && (
        <>
          {/* Rubric weights (read-only) */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
              Rubric Weights (read-only)
            </p>
            <p className="mb-4 text-xs text-[var(--foreground-muted)]">
              Weights are configured in code. Changes require deployment.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(RUBRIC_WEIGHTS).map(([key, weight]) => (
                <div
                  key={key}
                  className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3"
                >
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                    {(weight * 100).toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Alert thresholds (read-only) */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
              Alert Thresholds (read-only)
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                <span className="text-sm text-[var(--foreground)]">
                  Min Hit Rate
                </span>
                <span className="font-mono text-sm text-[var(--foreground-muted)]">
                  {ALERT_THRESHOLDS.minHitRatePercent}%
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                <span className="text-sm text-[var(--foreground)]">
                  Max Avg Cost / Deliverable
                </span>
                <span className="font-mono text-sm text-[var(--foreground-muted)]">
                  {formatCents(
                    ALERT_THRESHOLDS.maxAvgCostCentsPerDeliverable
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                <span className="text-sm text-[var(--foreground)]">
                  Max Provider Failure Rate
                </span>
                <span className="font-mono text-sm text-[var(--foreground-muted)]">
                  {ALERT_THRESHOLDS.maxProviderFailureRatePercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Threshold status (live) */}
          {pipelineMetrics && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                Current Threshold Status
              </p>
              <div className="space-y-2">
                <ThresholdBadge
                  label="Hit Rate"
                  value={pipelineMetrics.hitRate}
                  threshold={ALERT_THRESHOLDS.minHitRatePercent}
                  mode="min"
                />
                <ThresholdBadge
                  label="Avg Cost / Deliverable"
                  value={pipelineMetrics.avgCost}
                  threshold={
                    ALERT_THRESHOLDS.maxAvgCostCentsPerDeliverable
                  }
                  mode="max"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== PROVIDERS TAB ===== */}
      {activeTab === "providers" && (
        <>
          {providerHealthLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : providerHealthData && providerHealthData.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {providerHealthData.map((provider) => (
                <ProviderStatusCard
                  key={provider.provider}
                  provider={provider}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background-overlay)] p-4 text-center text-sm text-[var(--foreground-muted)]">
              No provider data available.
            </div>
          )}
        </>
      )}
    </div>
  );
}
