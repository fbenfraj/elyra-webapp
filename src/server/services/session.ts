import "server-only";

import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { and, desc, eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Session state machine
// ---------------------------------------------------------------------------

export type SessionStatus =
  | "pending"
  | "interpreting"
  | "generating_directions"
  | "selecting"
  | "direction_selected"
  | "paid"
  | "generating_images"
  | "evaluating"
  | "packaging"
  | "delivered"
  | "failed"
  // Legacy status present in earlier code — kept for backward-compat reads
  | "complete";

/**
 * Every legal forward (and recovery) transition in the pipeline.
 *
 * Reading guide:
 *  pending → interpreting           Brief submitted, interpretation starts
 *  interpreting → pending           Low-confidence — artist must supply more info
 *  interpreting → generating_dirs   Interpretation succeeded, direction gen starts
 *  generating_dirs → selecting      Directions ready for selection (was "complete")
 *  selecting → direction_selected   Artist picked a direction
 *  direction_selected → paid        Stripe payment confirmed
 *  paid → generating_images         Image generation starts
 *  generating_images → evaluating   Images produced, evaluation starts
 *  evaluating → selecting           Evaluation passed (or max retries exhausted)
 *  evaluating → generating_images   Retry: trigger prompt refinement + re-generate
 *  generating_images → selecting    Budget capped, show best results
 *  selecting → packaging            Artist confirmed image selection
 *  packaging → delivered            Package assembled
 *  * → failed                       Any stage can fail
 *  failed → pending                 Artist retries from scratch (reset)
 *
 * "complete" is a legacy alias for "selecting" kept for backward compatibility.
 */
export const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  pending: ["interpreting", "failed"],
  interpreting: ["pending", "generating_directions", "failed"],
  generating_directions: ["selecting", "complete", "failed"],
  // "complete" is the legacy name for "selecting" — allow forward from it
  complete: ["direction_selected", "selecting", "failed"],
  selecting: ["direction_selected", "packaging", "failed"],
  direction_selected: ["paid", "generating_images", "failed"],
  paid: ["generating_images", "failed"],
  generating_images: ["evaluating", "selecting", "failed"],
  evaluating: ["selecting", "generating_images", "failed"],
  packaging: ["delivered", "failed"],
  delivered: [],
  failed: ["pending", "interpreting", "generating_directions", "generating_images", "evaluating", "packaging"],
};

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid session status transition: "${from}" → "${to}"`);
    this.name = "InvalidTransitionError";
  }
}

export class StaleSessionError extends Error {
  constructor(sessionId: string) {
    super(
      `Session "${sessionId}" was concurrently modified. Status pre-condition failed.`
    );
    this.name = "StaleSessionError";
  }
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export async function deleteSessions(userId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) return;

  for (const id of sessionIds) {
    // Verify ownership before deleting
    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));

    if (!session) continue;

    // Delete child rows in dependency order, then the session.
    // feedback references generation_attempts, so it must be deleted first.
    await db.execute(
      sql`DELETE FROM feedback WHERE session_id = ${id}`
    );
    await db.execute(
      sql`DELETE FROM generation_attempts WHERE session_id = ${id}`
    );
    await db.execute(
      sql`DELETE FROM deliverables WHERE session_id = ${id}`
    );
    await db.execute(
      sql`DELETE FROM generation_jobs WHERE session_id = ${id}`
    );
    await db.execute(
      sql`DELETE FROM visual_specs WHERE session_id = ${id}`
    );
    await db.execute(
      sql`DELETE FROM payments WHERE session_id = ${id}`
    );
    await db.execute(
      sql`DELETE FROM session_events WHERE session_id = ${id}`
    );
    await db.execute(
      sql`DELETE FROM provider_metrics WHERE session_id = ${id}`
    );
    await db.execute(
      sql`DELETE FROM reference_images WHERE session_id = ${id}`
    );
    await db
      .delete(sessions)
      .where(eq(sessions.id, id));
  }
}

export async function createSession(userId: string, briefText: string) {
  const [session] = await db
    .insert(sessions)
    .values({ userId, briefText })
    .returning({ id: sessions.id });

  return session;
}

/**
 * Transition a session to a new status.
 *
 * Enforces two invariants:
 *  1. Transition validation: the (`current` → `newStatus`) pair must exist in
 *     `VALID_TRANSITIONS`.
 *  2. Optimistic locking: the UPDATE is conditioned on the current DB status
 *     matching the status we fetched. If another request already changed it,
 *     `rowCount === 0` and we throw `StaleSessionError`.
 *
 * @param sessionId  The session to update.
 * @param newStatus  The target status.
 * @param expectedCurrentStatus  If supplied, used as the WHERE pre-condition.
 *   When omitted the function fetches the current status from the DB first.
 */
export async function updateSessionStatus(
  sessionId: string,
  newStatus: SessionStatus,
  expectedCurrentStatus?: SessionStatus
): Promise<void> {
  // ------------------------------------------------------------------
  // 1. Determine the current status (either supplied or fetched)
  // ------------------------------------------------------------------
  let currentStatus: SessionStatus;

  if (expectedCurrentStatus !== undefined) {
    currentStatus = expectedCurrentStatus;
  } else {
    const [row] = await db
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!row) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    currentStatus = row.status as SessionStatus;
  }

  // ------------------------------------------------------------------
  // 2. Validate the transition
  // ------------------------------------------------------------------
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new InvalidTransitionError(currentStatus, newStatus);
  }

  // ------------------------------------------------------------------
  // 3. Optimistic-lock update: WHERE id = ? AND status = ?
  // ------------------------------------------------------------------
  const result = await db
    .update(sessions)
    .set({ status: newStatus, updatedAt: sql`now()` })
    .where(
      and(eq(sessions.id, sessionId), eq(sessions.status, currentStatus))
    )
    .returning({ id: sessions.id });

  if (result.length === 0) {
    throw new StaleSessionError(sessionId);
  }
}

/**
 * Mark a session as failed, recording which stage failed.
 *
 * Unlike `updateSessionStatus`, this does NOT validate transitions — any
 * status can transition to `failed`. It uses its own optimistic update with
 * the `failedStage` payload.
 *
 * failedStage values: interpreting, generating_directions, generating_images,
 *   prompt_refinement, evaluating, packaging, content_policy
 */
export async function failSession(
  sessionId: string,
  failedStage: string
): Promise<void> {
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
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  if (!session) {
    return {
      ok: false as const,
      error: { code: "NOT_FOUND", message: "Session not found" },
    };
  }

  // Directions are ready when status is "selecting" (or legacy "complete")
  if (session.status !== "selecting" && session.status !== "complete") {
    return {
      ok: false as const,
      error: {
        code: "INVALID_STATUS",
        message: "Directions are not ready for selection",
      },
    };
  }

  // Optimistic lock: only update if status hasn't changed since we checked
  const result = await db
    .update(sessions)
    .set({
      selectedDirectionId: directionId,
      selectedGenerationJobId: generationJobId ?? null,
      status: "direction_selected",
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.status, session.status as string)
      )
    )
    .returning({ id: sessions.id });

  if (result.length === 0) {
    return {
      ok: false as const,
      error: {
        code: "STALE_SESSION",
        message: "Session was modified concurrently. Please try again.",
      },
    };
  }

  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Edit brief (backward navigation)
// ---------------------------------------------------------------------------

/**
 * Statuses from which a user may edit the brief and restart interpretation.
 * Excludes statuses where async work is actively in progress.
 */
export const EDIT_BRIEF_ALLOWED_FROM: SessionStatus[] = [
  "selecting",
  "complete",
  "direction_selected",
  "paid",
  "generating_images",
  "evaluating",
  "delivered",
];

export async function editBrief(
  sessionId: string,
  userId: string,
  newBriefText: string
): Promise<
  | { ok: true }
  | { ok: false; error: { code: string; message: string } }
> {
  const [session] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      status: sessions.status,
      briefText: sessions.briefText,
      refinementCount: sessions.refinementCount,
      refinementHistory: sessions.refinementHistory,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  if (!session) {
    return {
      ok: false as const,
      error: { code: "NOT_FOUND", message: "Session not found" },
    };
  }

  if (
    !EDIT_BRIEF_ALLOWED_FROM.includes(session.status as SessionStatus)
  ) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_STATUS",
        message: `Cannot edit brief while session is ${session.status}`,
      },
    };
  }

  const historyEntry = {
    round: (session.refinementCount ?? 0) + 1,
    text: session.briefText,
    timestamp: new Date().toISOString(),
  };

  const currentHistory = Array.isArray(session.refinementHistory)
    ? (session.refinementHistory as Record<string, unknown>[])
    : [];

  const result = await db
    .update(sessions)
    .set({
      briefText: newBriefText,
      status: "interpreting",
      refinementCount: (session.refinementCount ?? 0) + 1,
      refinementHistory: [...currentHistory, historyEntry],
      selectedDirectionId: null,
      selectedGenerationJobId: null,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.status, session.status as string)
      )
    )
    .returning({ id: sessions.id });

  if (result.length === 0) {
    return {
      ok: false as const,
      error: {
        code: "STALE_SESSION",
        message: "Session was modified concurrently",
      },
    };
  }

  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Change direction post-payment (backward navigation)
// ---------------------------------------------------------------------------

/**
 * Statuses from which a paid user may switch to a different direction.
 * Excludes statuses where async work is actively in progress (packaging)
 * and any pre-payment status.
 */
export const CHANGE_DIRECTION_ALLOWED_FROM: SessionStatus[] = [
  "paid",
  "generating_images",
  "evaluating",
  "delivered",
];

export async function changeDirectionPostPayment(
  sessionId: string,
  userId: string,
  directionId: string,
  generationJobId: string
): Promise<
  | { ok: true }
  | { ok: false; error: { code: string; message: string } }
> {
  const [session] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      status: sessions.status,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  if (!session) {
    return {
      ok: false as const,
      error: { code: "NOT_FOUND", message: "Session not found" },
    };
  }

  if (
    !CHANGE_DIRECTION_ALLOWED_FROM.includes(session.status as SessionStatus)
  ) {
    return {
      ok: false as const,
      error: {
        code: "INVALID_STATUS",
        message: `Cannot change direction while session is ${session.status}`,
      },
    };
  }

  const result = await db
    .update(sessions)
    .set({
      selectedDirectionId: directionId,
      selectedGenerationJobId: generationJobId,
      status: "paid",
      regenCount: 0,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.status, session.status as string)
      )
    )
    .returning({ id: sessions.id });

  if (result.length === 0) {
    return {
      ok: false as const,
      error: {
        code: "STALE_SESSION",
        message: "Session was modified concurrently",
      },
    };
  }

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
