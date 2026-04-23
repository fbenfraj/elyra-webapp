import "server-only";

import { db } from "@/server/db";
import { providerMetrics } from "@/server/db/schema/provider-metrics";
import { sql } from "drizzle-orm";
import { getAllStates } from "@/server/services/circuit-breaker";
import { falAdapter } from "@/server/providers/fal";
import { openaiEvaluationAdapter } from "@/server/providers/openai";
import { anthropicEvaluationAdapter } from "@/server/providers/anthropic";
import type { ProviderHealth } from "@/types/provider";

const adapters: Record<string, { getHealth: () => Promise<ProviderHealth> }> = {
  fal: falAdapter,
  openai: openaiEvaluationAdapter,
  anthropic: anthropicEvaluationAdapter,
};

export async function getProviderStatuses() {
  const circuitStates = getAllStates();

  const statuses = await Promise.allSettled(
    Object.entries(adapters).map(async ([provider, adapter]) => {
      const health = await adapter.getHealth();
      return {
        provider,
        health,
        circuitBreakerState: circuitStates[provider] ?? {
          state: "closed" as const,
          failureCount: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          openedAt: null,
        },
      };
    })
  );

  return statuses
    .filter(
      (r): r is PromiseFulfilledResult<{
        provider: string;
        health: ProviderHealth;
        circuitBreakerState: {
          state: "closed" | "open" | "half-open";
          failureCount: number;
          lastFailureTime: number | null;
          lastSuccessTime: number | null;
          openedAt: number | null;
        };
      }> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}

export async function getProviderMetrics(
  provider: string,
  range?: { from: Date; to: Date }
) {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total_calls,
      COUNT(*) FILTER (WHERE success = true) as successful_calls,
      COUNT(*) FILTER (WHERE success = false) as failed_calls,
      AVG(duration_ms) as avg_duration_ms,
      MAX(CASE WHEN success = true THEN created_at END) as last_success,
      MAX(CASE WHEN success = false THEN created_at END) as last_failure
    FROM provider_metrics
    WHERE provider = ${provider}
    ${range ? sql`AND created_at >= ${range.from} AND created_at <= ${range.to}` : sql``}
  `);

  const row = result[0] as Record<string, unknown> | undefined;
  return {
    provider,
    totalCalls: Number(row?.total_calls ?? 0),
    successfulCalls: Number(row?.successful_calls ?? 0),
    failedCalls: Number(row?.failed_calls ?? 0),
    avgDurationMs: Number(row?.avg_duration_ms ?? 0),
    failureRate:
      Number(row?.total_calls ?? 0) > 0
        ? (Number(row?.failed_calls ?? 0) / Number(row?.total_calls ?? 0)) * 100
        : 0,
    lastSuccess: row?.last_success ? new Date(row.last_success as string) : null,
    lastFailure: row?.last_failure ? new Date(row.last_failure as string) : null,
  };
}

export function getCircuitBreakerStates() {
  return getAllStates();
}
