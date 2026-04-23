import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, like, and } from "drizzle-orm";
import { sessions } from "@/server/db/schema/sessions";
import { payments } from "@/server/db/schema/payments";
import { processedEvents } from "@/server/db/schema/processed-events";
import { users } from "@/server/db/schema/users";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { deliverables } from "@/server/db/schema/deliverables";
import { feedback } from "@/server/db/schema/feedback";
import { sessionEvents } from "@/server/db/schema/session-events";
import { providerMetrics } from "@/server/db/schema/provider-metrics";
import type { VisualSpec } from "@/lib/schemas/visual-spec";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set for E2E tests");
}

const testClient = postgres(connectionString);
export const testDb = drizzle(testClient);

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

export function createTestUserId(): string {
  return `test-user-${crypto.randomUUID()}`;
}

export async function createTestUser(userId: string): Promise<void> {
  await testDb.insert(users).values({ id: userId });
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

export async function cleanupTestUser(userId: string): Promise<void> {
  // Delete in reverse dependency order to respect FK constraints

  // feedback references generation_attempts
  await testDb.delete(feedback).where(eq(feedback.userId, userId));

  // session_events references sessions + users
  await testDb.delete(sessionEvents).where(eq(sessionEvents.userId, userId));

  // provider_metrics references sessions (nullable FK)
  const userSessions = await testDb
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  for (const s of userSessions) {
    await testDb
      .delete(providerMetrics)
      .where(eq(providerMetrics.sessionId, s.id));
  }

  // generation_attempts references generation_jobs + sessions
  for (const s of userSessions) {
    await testDb
      .delete(generationAttempts)
      .where(eq(generationAttempts.sessionId, s.id));
  }

  // deliverables references sessions
  for (const s of userSessions) {
    await testDb
      .delete(deliverables)
      .where(eq(deliverables.sessionId, s.id));
  }

  // generation_jobs references sessions + visual_specs
  for (const s of userSessions) {
    await testDb
      .delete(generationJobs)
      .where(eq(generationJobs.sessionId, s.id));
  }

  // visual_specs references sessions
  for (const s of userSessions) {
    await testDb
      .delete(visualSpecs)
      .where(eq(visualSpecs.sessionId, s.id));
  }

  // processed_events uses event_key pattern matching
  await testDb
    .delete(processedEvents)
    .where(like(processedEvents.eventKey, `%${userId}%`));

  await testDb.delete(payments).where(eq(payments.userId, userId));
  await testDb.delete(sessions).where(eq(sessions.userId, userId));
  await testDb.delete(users).where(eq(users.id, userId));
}

export async function closeTestConnection(): Promise<void> {
  await testClient.end();
}

// ---------------------------------------------------------------------------
// Session state helpers
// ---------------------------------------------------------------------------

/**
 * A mock VisualSpec suitable for insertion in tests.
 */
export const MOCK_VISUAL_SPEC: VisualSpec = {
  palette: ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560"],
  mood: "dark cinematic urban isolation",
  composition: "Low-angle perspective, deep shadows, neon reflections",
  style: "Photographic with high contrast, desaturated cool tones",
  culturalReferences: ["Travis Scott Astroworld", "Arca experimental"],
  genreContext: "dark trap",
};

/**
 * Insert a visual_spec row directly (bypasses the interpretation service).
 * Returns the inserted row id.
 */
export async function insertVisualSpec(
  sessionId: string,
  specData: VisualSpec = MOCK_VISUAL_SPEC
): Promise<string> {
  const [row] = await testDb
    .insert(visualSpecs)
    .values({ sessionId, specData })
    .returning({ id: visualSpecs.id });
  return row.id;
}

/**
 * Insert a generation_job row directly with stubbed direction data.
 * Returns the inserted row id.
 */
export async function insertGenerationJob(
  sessionId: string,
  visualSpecId: string,
  directionId?: string
): Promise<string> {
  const resolvedDirId = directionId ?? `${sessionId}-dir-0`;
  const directionData = {
    directions: [
      {
        id: resolvedDirId,
        heroImageKey: `sessions/${sessionId}/directions/0/hero.webp`,
        moodLabel: "Dark cinematic / urban isolation",
        tags: ["moody", "urban", "cinematic"],
        supportingImageKeys: [
          `sessions/${sessionId}/directions/0/support-0.webp`,
          `sessions/${sessionId}/directions/0/support-1.webp`,
        ],
        colorPalette: ["#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560"],
        description: "Low-key lighting with deep shadows and desaturated cool tones",
      },
    ],
  };

  const [row] = await testDb
    .insert(generationJobs)
    .values({
      sessionId,
      visualSpecId,
      directionData,
      status: "complete",
    })
    .returning({ id: generationJobs.id });

  return row.id;
}

/**
 * Insert a generation_attempt row directly (bypasses the image-generation service).
 * Returns the inserted row id.
 */
export async function insertGenerationAttempt(
  sessionId: string,
  generationJobId: string,
  overrides?: {
    evaluationScore?: number;
    evaluationFeedback?: Record<string, unknown>;
    selected?: boolean;
    batchNumber?: number;
    costCents?: number;
  }
): Promise<string> {
  const attemptId = crypto.randomUUID();
  const [row] = await testDb
    .insert(generationAttempts)
    .values({
      sessionId,
      generationJobId,
      imageKey: `sessions/${sessionId}/attempts/${attemptId}.webp`,
      promptUsed: "Test prompt for E2E",
      model: "fal-ai/flux-pro/v2",
      provider: "fal",
      costCents: overrides?.costCents ?? 5,
      durationMs: 1200,
      evaluationScore: overrides?.evaluationScore ?? null,
      evaluationFeedback: overrides?.evaluationFeedback ?? null,
      selected: overrides?.selected ?? false,
      batchNumber: overrides?.batchNumber ?? 1,
    })
    .returning({ id: generationAttempts.id });

  return row.id;
}

/**
 * Creates a session advanced to a given state. Inserts supporting records as needed.
 *
 * States supported:
 *  - "pending"              — just a session row
 *  - "selecting"            — session + visual_spec + generation_job
 *  - "direction_selected"   — above + session.selectedDirectionId set
 *  - "paid"                 — above + payment record
 *  - "generating_images"    — session status only, supports full image pipeline
 *
 * Returns an object with all created IDs for reference in tests.
 */
export async function createFullSession(
  userId: string,
  state: "pending" | "selecting" | "direction_selected" | "paid" | "generating_images" = "pending",
  briefText = "dark trap nighttime city vibes"
): Promise<{
  sessionId: string;
  visualSpecId: string | null;
  generationJobId: string | null;
  directionId: string | null;
}> {
  // Step 1: Insert session in target state
  const [session] = await testDb
    .insert(sessions)
    .values({ userId, briefText, status: state === "paid" || state === "direction_selected" || state === "generating_images" ? state : state })
    .returning({ id: sessions.id });

  const sessionId = session.id;

  if (state === "pending") {
    return { sessionId, visualSpecId: null, generationJobId: null, directionId: null };
  }

  // Step 2: Insert visual spec
  const visualSpecId = await insertVisualSpec(sessionId);

  // Step 3: Insert generation job with direction data
  const directionId = `${sessionId}-dir-0`;
  const generationJobId = await insertGenerationJob(sessionId, visualSpecId, directionId);

  if (state === "selecting") {
    // Update status to selecting (directions ready)
    await testDb
      .update(sessions)
      .set({ status: "selecting" })
      .where(eq(sessions.id, sessionId));
    return { sessionId, visualSpecId, generationJobId, directionId };
  }

  // Step 4: Set selected direction for direction_selected / paid / generating_images
  await testDb
    .update(sessions)
    .set({
      status: "direction_selected",
      selectedDirectionId: directionId,
      selectedGenerationJobId: generationJobId,
    })
    .where(eq(sessions.id, sessionId));

  if (state === "direction_selected") {
    return { sessionId, visualSpecId, generationJobId, directionId };
  }

  // Step 5: Insert payment record and update to paid
  const fakeStripeSessionId = `cs_test_${crypto.randomUUID()}`;
  await testDb.insert(payments).values({
    sessionId,
    userId,
    stripeSessionId: fakeStripeSessionId,
    amountCents: 700,
    currency: "eur",
    status: "completed",
  });

  await testDb
    .update(sessions)
    .set({ status: "paid", maxRegens: 3, regenCount: 0 })
    .where(eq(sessions.id, sessionId));

  if (state === "paid") {
    return { sessionId, visualSpecId, generationJobId, directionId };
  }

  // generating_images
  await testDb
    .update(sessions)
    .set({ status: "generating_images" })
    .where(eq(sessions.id, sessionId));

  return { sessionId, visualSpecId, generationJobId, directionId };
}

// ---------------------------------------------------------------------------
// Provider circuit-breaker helpers
// ---------------------------------------------------------------------------

/**
 * Simulates provider failure by forcing the circuit breaker open for a provider.
 * Uses the circuit-breaker module's internal state.
 *
 * Because the circuit-breaker uses in-memory state, this must be called in the
 * same Node.js process as the tests. After tests call this, they should call
 * `_resetAll()` from circuit-breaker to restore the default closed state.
 */
// ---------------------------------------------------------------------------
// Deliverable helpers
// ---------------------------------------------------------------------------

/**
 * Insert a deliverable row directly (bypasses the packaging service).
 * Returns the inserted row id.
 */
export async function insertDeliverable(
  sessionId: string,
  overrides?: {
    format?: string;
    fileKey?: string;
    fileSizeBytes?: number;
    width?: number | null;
    height?: number | null;
    mimeType?: string;
  }
): Promise<string> {
  const [row] = await testDb
    .insert(deliverables)
    .values({
      sessionId,
      format: overrides?.format ?? "cover-spotify",
      fileKey:
        overrides?.fileKey ??
        `sessions/${sessionId}/package/cover-spotify.jpg`,
      fileSizeBytes: overrides?.fileSizeBytes ?? 102400,
      width: overrides?.width ?? 3000,
      height: overrides?.height ?? 3000,
      mimeType: overrides?.mimeType ?? "image/jpeg",
    })
    .returning({ id: deliverables.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Feedback helpers
// ---------------------------------------------------------------------------

/**
 * Insert a feedback row directly (bypasses the feedback service).
 * Returns the inserted row id.
 */
export async function insertFeedback(
  userId: string,
  sessionId: string,
  generationAttemptId: string,
  action: "like" | "unlike" = "like"
): Promise<string> {
  const [row] = await testDb
    .insert(feedback)
    .values({ userId, sessionId, generationAttemptId, action })
    .returning({ id: feedback.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Session event helpers
// ---------------------------------------------------------------------------

/**
 * Insert a session event row directly (bypasses the event-capture service).
 * Returns the inserted row id.
 */
export async function insertSessionEvent(
  userId: string,
  sessionId: string,
  action: string,
  payload?: Record<string, unknown>
): Promise<string> {
  const [row] = await testDb
    .insert(sessionEvents)
    .values({ userId, sessionId, action, payload: payload ?? null })
    .returning({ id: sessionEvents.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Provider circuit-breaker helpers
// ---------------------------------------------------------------------------

export async function simulateProviderFailure(
  provider: string,
  failureCount: number = 5
): Promise<void> {
  // Dynamic import to avoid module-level side effects
  const { recordFailure } = await import("@/server/services/circuit-breaker");
  for (let i = 0; i < failureCount; i++) {
    recordFailure(provider);
  }
}
