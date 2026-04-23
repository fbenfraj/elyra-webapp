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

export async function selectDirection(
  sessionId: string,
  userId: string,
  directionIndex: number,
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
      selectedDirectionIndex: directionIndex,
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
