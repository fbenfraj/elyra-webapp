import "server-only";

import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import { eq, desc, sql } from "drizzle-orm";
import { MIN_PASS_SCORE } from "@/config/evaluation";

type SessionFilter = {
  zeroHitRate?: boolean;
  lowScores?: boolean;
  highRetries?: boolean;
  vagueBriefs?: boolean;
};

export async function getProblematicSessions(
  filters: SessionFilter,
  dateRange?: { from: Date; to: Date },
  limit = 50
) {
  const conditions: string[] = [];

  if (filters.zeroHitRate) {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM generation_attempts ga2 WHERE ga2.session_id = s.id AND ga2.evaluation_score >= ${MIN_PASS_SCORE})`
    );
  }
  if (filters.lowScores) {
    conditions.push(
      `(SELECT AVG(ga2.evaluation_score) FROM generation_attempts ga2 WHERE ga2.session_id = s.id AND ga2.evaluation_score IS NOT NULL) < 0.5`
    );
  }
  if (filters.highRetries) {
    conditions.push(
      `(SELECT MAX(ga2.batch_number) FROM generation_attempts ga2 WHERE ga2.session_id = s.id) > 2`
    );
  }
  if (filters.vagueBriefs) {
    conditions.push(`s.refinement_count >= 3`);
  }

  const dateFilter = dateRange
    ? sql`AND s.created_at >= ${dateRange.from} AND s.created_at <= ${dateRange.to}`
    : sql``;

  const filterClause =
    conditions.length > 0
      ? sql.raw(`AND (${conditions.join(" OR ")})`)
      : sql``;

  const result = await db.execute(sql`
    SELECT s.id, s.brief_text, s.status, s.refinement_count, s.created_at,
      COALESCE(SUM(ga.cost_cents), 0) as total_cost_cents,
      COUNT(ga.id) as attempt_count,
      AVG(ga.evaluation_score) as avg_eval_score
    FROM sessions s
    LEFT JOIN generation_attempts ga ON ga.session_id = s.id
    WHERE 1=1 ${dateFilter} ${filterClause}
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT ${limit}
  `);

  return result as Record<string, unknown>[];
}

export async function getSessionDetail(sessionId: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session) return null;

  const [spec] = await db
    .select({ specData: visualSpecs.specData })
    .from(visualSpecs)
    .where(eq(visualSpecs.sessionId, sessionId));

  const attempts = await db
    .select()
    .from(generationAttempts)
    .where(eq(generationAttempts.sessionId, sessionId))
    .orderBy(desc(generationAttempts.evaluationScore));

  const totalCostCents = attempts.reduce((sum, a) => sum + a.costCents, 0);

  return {
    session: {
      id: session.id,
      briefText: session.briefText,
      status: session.status,
      refinementCount: session.refinementCount,
      refinementHistory: session.refinementHistory,
      createdAt: session.createdAt,
    },
    visualSpec: spec?.specData ?? null,
    attempts: attempts.map((a) => ({
      id: a.id,
      promptUsed: a.promptUsed,
      evaluationScore: a.evaluationScore,
      evaluationFeedback: a.evaluationFeedback,
      selected: a.selected,
      costCents: a.costCents,
      model: a.model,
      provider: a.provider,
      batchNumber: a.batchNumber,
    })),
    totalCostCents,
  };
}
