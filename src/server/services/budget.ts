import "server-only";

import { db } from "@/server/db";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { sessions } from "@/server/db/schema/sessions";
import { eq, sql } from "drizzle-orm";
import {
  MAX_SESSION_COST_CENTS,
  MAX_USER_DAILY_COST_CENTS,
} from "@/config/limits";

export async function getSessionCost(sessionId: string): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${generationAttempts.costCents}), 0)`,
    })
    .from(generationAttempts)
    .where(eq(generationAttempts.sessionId, sessionId));

  return Number(result[0]?.total ?? 0);
}

export async function checkSessionBudget(sessionId: string): Promise<{
  allowed: boolean;
  currentCostCents: number;
  limitCents: number;
}> {
  try {
    const currentCostCents = await getSessionCost(sessionId);
    return {
      allowed: currentCostCents < MAX_SESSION_COST_CENTS,
      currentCostCents,
      limitCents: MAX_SESSION_COST_CENTS,
    };
  } catch (error) {
    // Fail-open: allow generation if budget check fails
    console.error(
      JSON.stringify({
        event: "budget_check_failed",
        scope: "session",
        sessionId,
        error: String(error),
      })
    );
    return {
      allowed: true,
      currentCostCents: 0,
      limitCents: MAX_SESSION_COST_CENTS,
    };
  }
}

export async function getUserDailyCost(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${generationAttempts.costCents}), 0)`,
    })
    .from(generationAttempts)
    .innerJoin(sessions, eq(sessions.id, generationAttempts.sessionId))
    .where(
      sql`${sessions.userId} = ${userId} AND ${generationAttempts.createdAt} >= ${today}`
    );

  return Number(result[0]?.total ?? 0);
}

export async function checkUserBudget(userId: string): Promise<{
  allowed: boolean;
  currentCostCents: number;
  limitCents: number;
}> {
  try {
    const currentCostCents = await getUserDailyCost(userId);
    return {
      allowed: currentCostCents < MAX_USER_DAILY_COST_CENTS,
      currentCostCents,
      limitCents: MAX_USER_DAILY_COST_CENTS,
    };
  } catch (error) {
    // Fail-open: allow generation if budget check fails
    console.error(
      JSON.stringify({
        event: "budget_check_failed",
        scope: "user",
        userId,
        error: String(error),
      })
    );
    return {
      allowed: true,
      currentCostCents: 0,
      limitCents: MAX_USER_DAILY_COST_CENTS,
    };
  }
}
