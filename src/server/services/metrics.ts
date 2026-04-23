import "server-only";

import { db } from "@/server/db";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { eq, sql } from "drizzle-orm";
import { MIN_PASS_SCORE } from "@/config/evaluation";

type DateRange = { from: Date; to: Date };

export async function getHitRate(range?: DateRange): Promise<number> {
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT CASE WHEN ga.evaluation_score >= ${MIN_PASS_SCORE} AND ga.selected = true THEN s.id END) * 100.0
      / NULLIF(COUNT(DISTINCT s.id), 0) as hit_rate
    FROM sessions s
    LEFT JOIN generation_attempts ga ON ga.session_id = s.id
    WHERE s.status IN ('complete', 'delivered')
    ${range ? sql`AND s.created_at >= ${range.from} AND s.created_at <= ${range.to}` : sql``}
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return Number(row?.hit_rate ?? 0);
}

export async function getGenerationSuccessRate(
  range?: DateRange
): Promise<{ firstAttempt: number; overall: number }> {
  const result = await db.execute(sql`
    WITH session_stats AS (
      SELECT
        ga.session_id,
        bool_or(ga.evaluation_score >= ${MIN_PASS_SCORE} AND ga.batch_number = 1) as first_attempt_pass,
        bool_or(ga.evaluation_score >= ${MIN_PASS_SCORE}) as any_pass
      FROM generation_attempts ga
      JOIN sessions s ON s.id = ga.session_id
      WHERE s.status IN ('complete', 'delivered')
      ${range ? sql`AND s.created_at >= ${range.from} AND s.created_at <= ${range.to}` : sql``}
      GROUP BY ga.session_id
    )
    SELECT
      COUNT(*) FILTER (WHERE first_attempt_pass) * 100.0 / NULLIF(COUNT(*), 0) as first_attempt_rate,
      COUNT(*) FILTER (WHERE any_pass) * 100.0 / NULLIF(COUNT(*), 0) as overall_rate
    FROM session_stats
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return {
    firstAttempt: Number(row?.first_attempt_rate ?? 0),
    overall: Number(row?.overall_rate ?? 0),
  };
}

export async function getAverageCostPerDeliverable(
  range?: DateRange
): Promise<number> {
  const result = await db.execute(sql`
    SELECT
      SUM(ga.cost_cents) * 1.0 / NULLIF(COUNT(DISTINCT ga.session_id), 0) as avg_cost
    FROM generation_attempts ga
    JOIN sessions s ON s.id = ga.session_id
    WHERE s.status IN ('complete', 'delivered')
    ${range ? sql`AND s.created_at >= ${range.from} AND s.created_at <= ${range.to}` : sql``}
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return Number(row?.avg_cost ?? 0);
}

export async function getAverageLatency(range?: DateRange): Promise<number> {
  const result = await db.execute(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at)) * 1000) as avg_latency_ms
    FROM sessions s
    WHERE s.status IN ('complete', 'delivered')
    ${range ? sql`AND s.created_at >= ${range.from} AND s.created_at <= ${range.to}` : sql``}
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return Number(row?.avg_latency_ms ?? 0);
}

export async function getEvalScoreDistribution(
  range?: DateRange
): Promise<Record<string, number>> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE ga.evaluation_score < 0.3) as "0-0.3",
      COUNT(*) FILTER (WHERE ga.evaluation_score >= 0.3 AND ga.evaluation_score < 0.5) as "0.3-0.5",
      COUNT(*) FILTER (WHERE ga.evaluation_score >= 0.5 AND ga.evaluation_score < 0.7) as "0.5-0.7",
      COUNT(*) FILTER (WHERE ga.evaluation_score >= 0.7 AND ga.evaluation_score < 0.85) as "0.7-0.85",
      COUNT(*) FILTER (WHERE ga.evaluation_score >= 0.85) as "0.85-1.0"
    FROM generation_attempts ga
    JOIN sessions s ON s.id = ga.session_id
    WHERE ga.evaluation_score IS NOT NULL
    ${range ? sql`AND s.created_at >= ${range.from} AND s.created_at <= ${range.to}` : sql``}
  `);
  const row = (result[0] ?? {}) as Record<string, unknown>;
  return {
    "0-0.3": Number(row["0-0.3"] ?? 0),
    "0.3-0.5": Number(row["0.3-0.5"] ?? 0),
    "0.5-0.7": Number(row["0.5-0.7"] ?? 0),
    "0.7-0.85": Number(row["0.7-0.85"] ?? 0),
    "0.85-1.0": Number(row["0.85-1.0"] ?? 0),
  };
}

export async function getSessionCostBreakdown(sessionId: string) {
  const attempts = await db
    .select({
      costCents: generationAttempts.costCents,
      model: generationAttempts.model,
      provider: generationAttempts.provider,
    })
    .from(generationAttempts)
    .where(eq(generationAttempts.sessionId, sessionId));

  const total = attempts.reduce((sum, a) => sum + a.costCents, 0);
  return { sessionId, totalCostCents: total, attempts };
}

export async function getCostOutliers(
  thresholdCents: number,
  range?: DateRange
) {
  const result = await db.execute(sql`
    SELECT s.id, s.brief_text, s.created_at, s.status,
      SUM(ga.cost_cents) as total_cost_cents,
      COUNT(ga.id) as attempt_count
    FROM sessions s
    JOIN generation_attempts ga ON ga.session_id = s.id
    ${range ? sql`WHERE s.created_at >= ${range.from} AND s.created_at <= ${range.to}` : sql``}
    GROUP BY s.id
    HAVING SUM(ga.cost_cents) > ${thresholdCents}
    ORDER BY total_cost_cents DESC
  `);
  return result as Record<string, unknown>[];
}

export async function getSessionsWithCosts(range?: DateRange, limit = 50) {
  const result = await db.execute(sql`
    SELECT s.id, s.brief_text, s.status, s.created_at,
      COALESCE(SUM(ga.cost_cents), 0) as total_cost_cents,
      COUNT(ga.id) as attempt_count,
      AVG(ga.evaluation_score) as avg_eval_score
    FROM sessions s
    LEFT JOIN generation_attempts ga ON ga.session_id = s.id
    ${range ? sql`WHERE s.created_at >= ${range.from} AND s.created_at <= ${range.to}` : sql``}
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT ${limit}
  `);
  return result as Record<string, unknown>[];
}
