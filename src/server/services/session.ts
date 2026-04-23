import "server-only";

import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { and, desc, eq, sql } from "drizzle-orm";

export async function createSession(userId: string, briefText: string) {
  const [session] = await db
    .insert(sessions)
    .values({ userId, briefText })
    .returning({ id: sessions.id });

  return session;
}

export async function updateSessionStatus(sessionId: string, status: string) {
  await db
    .update(sessions)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(sessions.id, sessionId));
}

/**
 * Mark a session as failed, recording which stage failed.
 * failedStage values: interpreting, generating_directions, generating_images, evaluating, packaging
 */
export async function failSession(sessionId: string, failedStage: string) {
  await db
    .update(sessions)
    .set({ status: "failed", failedStage, updatedAt: sql`now()` })
    .where(eq(sessions.id, sessionId));
}

/** Clear the failedStage after a successful retry reset. */
export async function clearFailedStage(sessionId: string) {
  await db
    .update(sessions)
    .set({ failedStage: null, updatedAt: sql`now()` })
    .where(eq(sessions.id, sessionId));
}

/** Get a session by ID (for retry logic). */
export async function getSessionById(sessionId: string) {
  const [session] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      status: sessions.status,
      failedStage: sessions.failedStage,
      briefText: sessions.briefText,
      regenCount: sessions.regenCount,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  return session ?? null;
}

export async function selectDirection(
  sessionId: string,
  userId: string,
  directionId: string,
  generationJobId?: string
) {
  const [session] = await db
    .select({ id: sessions.id, status: sessions.status })
    .from(sessions)
    .where(
      and(eq(sessions.id, sessionId), eq(sessions.userId, userId))
    );

  if (!session) {
    return { ok: false as const, error: { code: "NOT_FOUND", message: "Session not found" } };
  }

  if (session.status !== "complete") {
    return {
      ok: false as const,
      error: { code: "INVALID_STATUS", message: "Directions are not ready for selection" },
    };
  }

  await db
    .update(sessions)
    .set({
      selectedDirectionId: directionId,
      selectedGenerationJobId: generationJobId ?? null,
      status: "direction_selected",
      updatedAt: sql`now()`,
    })
    .where(eq(sessions.id, sessionId));

  return { ok: true as const };
}

export async function listByUserId(userId: string) {
  return db
    .select({
      id: sessions.id,
      briefText: sessions.briefText,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));
}
