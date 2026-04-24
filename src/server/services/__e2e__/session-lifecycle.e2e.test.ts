// Must mock "server-only" before any service imports — services use it at module level
vi.mock("server-only", () => ({}));

// Must mock "stripe" since payment.ts imports it at module level
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  testDb,
  createTestUserId,
  createTestUser,
  cleanupTestUser,
  closeTestConnection,
} from "./setup";
import { sessions } from "@/server/db/schema/sessions";
import { payments } from "@/server/db/schema/payments";
import { processedEvents } from "@/server/db/schema/processed-events";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { deliverables } from "@/server/db/schema/deliverables";
import { users } from "@/server/db/schema/users";
import { createSession, updateSessionStatus, selectDirection } from "@/server/services/session";
import {
  handleWebhookEvent,
  checkPackBoundary,
  incrementRegenCount,
} from "@/server/services/payment";
import { withIdempotency } from "@/server/services/idempotency";
import { PACK_REGEN_LIMIT } from "@/config/pricing";

/**
 * Walk a session through legal transitions to reach direction_selected.
 * pending → interpreting → generating_directions → selecting → direction_selected
 */
async function advanceToDirectionSelected(sessionId: string, userId: string): Promise<void> {
  await updateSessionStatus(sessionId, "interpreting");
  await updateSessionStatus(sessionId, "generating_directions");
  await updateSessionStatus(sessionId, "selecting");
  await selectDirection(sessionId, userId, `${sessionId}-dir-0`, `${sessionId}-job-0`);
}

// ---------- Session Lifecycle ----------

describe("Session Lifecycle E2E", () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = createTestUserId();
    await createTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  it("creates a session with correct initial state", async () => {
    const session = await createSession(testUserId, "dark trap nighttime city vibes");

    expect(session.id).toBeDefined();

    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));

    expect(dbSession).toBeDefined();
    expect(dbSession.status).toBe("pending");
    expect(dbSession.regenCount).toBe(0);
    expect(dbSession.maxRegens).toBe(3);
    expect(dbSession.userId).toBe(testUserId);
    expect(dbSession.briefText).toBe("dark trap nighttime city vibes");
    expect(dbSession.refinementCount).toBe(0);
    expect(dbSession.selectedDirectionId).toBeNull();
    expect(dbSession.createdAt).toBeInstanceOf(Date);
    expect(dbSession.updatedAt).toBeInstanceOf(Date);
  });

  it("updates session status", async () => {
    const session = await createSession(testUserId, "ambient electronic sunrise");

    await updateSessionStatus(session.id, "interpreting");

    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));

    expect(dbSession.status).toBe("interpreting");
  });

  it("simulates full session lifecycle through status transitions", async () => {
    const session = await createSession(testUserId, "lo-fi hip hop study beats");

    // pending -> interpreting
    await updateSessionStatus(session.id, "interpreting");
    let [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("interpreting");

    // interpreting -> generating_directions
    await updateSessionStatus(session.id, "generating_directions");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("generating_directions");

    // generating_directions -> complete
    await updateSessionStatus(session.id, "complete");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("complete");

    // complete -> direction_selected via selectDirection
    const result = await selectDirection(session.id, testUserId, "dir-1", "gen-job-123");
    expect(result.ok).toBe(true);

    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("direction_selected");
    expect(dbSession.selectedDirectionId).toBe("dir-1");
    expect(dbSession.selectedGenerationJobId).toBe("gen-job-123");
  });
});

// ---------- Full Pipeline Lifecycle ----------

describe("Full Pipeline Lifecycle E2E", () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = createTestUserId();
    await createTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  it("transitions through the full happy-path pipeline", async () => {
    const session = await createSession(testUserId, "full pipeline test");

    // pending → interpreting
    await updateSessionStatus(session.id, "interpreting");
    let [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("interpreting");

    // interpreting → generating_directions
    await updateSessionStatus(session.id, "generating_directions");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("generating_directions");

    // generating_directions → selecting
    await updateSessionStatus(session.id, "selecting");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("selecting");

    // selecting → direction_selected via selectDirection
    const selResult = await selectDirection(session.id, testUserId, "dir-1", "gen-job-1");
    expect(selResult.ok).toBe(true);
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("direction_selected");
    expect(dbSession.selectedDirectionId).toBe("dir-1");

    // direction_selected → paid (via webhook in real flow, direct here)
    await updateSessionStatus(session.id, "paid");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("paid");

    // paid → generating_images
    await updateSessionStatus(session.id, "generating_images");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("generating_images");

    // generating_images → evaluating
    await updateSessionStatus(session.id, "evaluating");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("evaluating");

    // evaluating → selecting (images evaluated, ready for user selection)
    await updateSessionStatus(session.id, "selecting");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("selecting");

    // selecting → packaging (user confirmed selection via confirmSelection)
    await updateSessionStatus(session.id, "packaging");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("packaging");

    // packaging → delivered
    await updateSessionStatus(session.id, "delivered");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("delivered");
  });

  it("verifies no orphaned records exist after full lifecycle", async () => {
    const session = await createSession(testUserId, "orphan check test");
    const sessionId = session.id;

    // Build supporting records
    const { insertVisualSpec, insertGenerationJob, insertGenerationAttempt, insertDeliverable } = await import("./setup");
    const visualSpecId = await insertVisualSpec(sessionId);
    const generationJobId = await insertGenerationJob(sessionId, visualSpecId);
    const attemptId = await insertGenerationAttempt(sessionId, generationJobId, { evaluationScore: 0.85, selected: true });
    await insertDeliverable(sessionId);

    // Verify all records reference the same session
    const [spec] = await testDb
      .select()
      .from(visualSpecs)
      .where(eq(visualSpecs.sessionId, sessionId));
    expect(spec).toBeDefined();

    const [job] = await testDb
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.sessionId, sessionId));
    expect(job).toBeDefined();
    expect(job.visualSpecId).toBe(visualSpecId);

    const [attempt] = await testDb
      .select()
      .from(generationAttempts)
      .where(eq(generationAttempts.sessionId, sessionId));
    expect(attempt).toBeDefined();
    expect(attempt.generationJobId).toBe(generationJobId);

    const [deliverable] = await testDb
      .select()
      .from(deliverables)
      .where(eq(deliverables.sessionId, sessionId));
    expect(deliverable).toBeDefined();
    expect(deliverable.sessionId).toBe(sessionId);
  });

  it("rejects invalid state transitions", async () => {
    const session = await createSession(testUserId, "invalid transition test");

    // pending → complete should be rejected
    await expect(
      updateSessionStatus(session.id, "complete")
    ).rejects.toThrow("Invalid session status transition");

    // pending → delivered should be rejected
    await expect(
      updateSessionStatus(session.id, "delivered")
    ).rejects.toThrow("Invalid session status transition");

    // pending → paid should be rejected
    await expect(
      updateSessionStatus(session.id, "paid")
    ).rejects.toThrow("Invalid session status transition");

    // Verify session status hasn't changed
    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("pending");
  });

  it("allows any status to transition to failed", async () => {
    const { failSession } = await import("@/server/services/session");
    const session = await createSession(testUserId, "fail test");

    await failSession(session.id, "interpreting");

    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("failed");
    expect(dbSession.failedStage).toBe("interpreting");
  });
});

// ---------- Payment Flow ----------

describe("Payment Flow E2E", () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = createTestUserId();
    await createTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  it("handles webhook event and updates session to paid", async () => {
    // Create a session and advance it to direction_selected (required for payment)
    const session = await createSession(testUserId, "synthwave retro future");
    await updateSessionStatus(session.id, "direction_selected");

    const fakeStripeSessionId = `cs_test_${crypto.randomUUID()}`;

    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: fakeStripeSessionId,
          metadata: { sessionId: session.id, userId: testUserId },
          amount_total: 700,
          currency: "eur",
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(fakeEvent);

    // Verify payment row created
    const [payment] = await testDb
      .select()
      .from(payments)
      .where(eq(payments.sessionId, session.id));

    expect(payment).toBeDefined();
    expect(payment.stripeSessionId).toBe(fakeStripeSessionId);
    expect(payment.amountCents).toBe(700);
    expect(payment.currency).toBe("eur");
    expect(payment.status).toBe("completed");
    expect(payment.userId).toBe(testUserId);

    // Verify session status updated to paid
    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));

    expect(dbSession.status).toBe("paid");
    expect(dbSession.maxRegens).toBe(PACK_REGEN_LIMIT);
    expect(dbSession.regenCount).toBe(0);
  });

  it("checkPackBoundary returns correct state for paid session", async () => {
    const session = await createSession(testUserId, "jazz fusion");
    await updateSessionStatus(session.id, "direction_selected");

    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_test_${crypto.randomUUID()}`,
          metadata: { sessionId: session.id, userId: testUserId },
          amount_total: 700,
          currency: "eur",
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(fakeEvent);

    const boundary = await checkPackBoundary(session.id, testUserId);

    expect(boundary.isPaid).toBe(true);
    expect(boundary.canRegenerate).toBe(true);
    expect(boundary.regenCount).toBe(0);
    expect(boundary.maxRegens).toBe(PACK_REGEN_LIMIT);
  });

  it("incrementRegenCount exhausts regenerations", async () => {
    const session = await createSession(testUserId, "punk rock energy");
    await updateSessionStatus(session.id, "direction_selected");

    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_test_${crypto.randomUUID()}`,
          metadata: { sessionId: session.id, userId: testUserId },
          amount_total: 700,
          currency: "eur",
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(fakeEvent);

    // Increment regen count up to the limit
    for (let i = 0; i < PACK_REGEN_LIMIT; i++) {
      await incrementRegenCount(session.id);
    }

    const boundary = await checkPackBoundary(session.id, testUserId);

    expect(boundary.isPaid).toBe(true);
    expect(boundary.canRegenerate).toBe(false);
    expect(boundary.regenCount).toBe(PACK_REGEN_LIMIT);
    expect(boundary.maxRegens).toBe(PACK_REGEN_LIMIT);
  });
});

// ---------- Payment + Pack Boundary (Task 5 extensions) ----------

describe("Payment and Pack Boundary E2E", () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = createTestUserId();
    await createTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  it("idempotent webhook redelivery produces no duplicate payment records", async () => {
    const session = await createSession(testUserId, "idempotency test brief");
    await advanceToDirectionSelected(session.id, testUserId);

    const fakeStripeSessionId = `cs_test_${crypto.randomUUID()}`;

    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: fakeStripeSessionId,
          metadata: { sessionId: session.id, userId: testUserId },
          amount_total: 700,
          currency: "eur",
        },
      },
    } as unknown as Stripe.Event;

    // First delivery
    await handleWebhookEvent(fakeEvent);

    // Second delivery (redelivery) — should be a no-op
    await handleWebhookEvent(fakeEvent);

    // Verify only ONE payment record was created
    const paymentRecords = await testDb
      .select()
      .from(payments)
      .where(eq(payments.sessionId, session.id));

    expect(paymentRecords).toHaveLength(1);
    expect(paymentRecords[0].stripeSessionId).toBe(fakeStripeSessionId);
    expect(paymentRecords[0].status).toBe("completed");
  });

  it("enforces regeneration limit and blocks when PACK_REGEN_LIMIT is reached", async () => {
    const session = await createSession(testUserId, "regen limit test brief");
    await advanceToDirectionSelected(session.id, testUserId);

    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_test_${crypto.randomUUID()}`,
          metadata: { sessionId: session.id, userId: testUserId },
          amount_total: 700,
          currency: "eur",
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(fakeEvent);

    // Verify regeneration starts at 0
    let boundary = await checkPackBoundary(session.id, testUserId);
    expect(boundary.regenCount).toBe(0);
    expect(boundary.canRegenerate).toBe(true);

    // Exhaust regenerations
    for (let i = 0; i < PACK_REGEN_LIMIT; i++) {
      await incrementRegenCount(session.id);
    }

    // Verify boundary is now exhausted
    boundary = await checkPackBoundary(session.id, testUserId);
    expect(boundary.isPaid).toBe(true);
    expect(boundary.canRegenerate).toBe(false);
    expect(boundary.regenCount).toBe(PACK_REGEN_LIMIT);
    expect(boundary.maxRegens).toBe(PACK_REGEN_LIMIT);
  });

  it("payment record has correct amount, currency, and status after webhook", async () => {
    const session = await createSession(testUserId, "payment fields test");
    await advanceToDirectionSelected(session.id, testUserId);

    const fakeStripeSessionId = `cs_test_${crypto.randomUUID()}`;
    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: fakeStripeSessionId,
          metadata: { sessionId: session.id, userId: testUserId },
          amount_total: 700,
          currency: "eur",
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(fakeEvent);

    const [payment] = await testDb
      .select()
      .from(payments)
      .where(eq(payments.sessionId, session.id));

    expect(payment).toBeDefined();
    expect(payment.amountCents).toBe(700);
    expect(payment.currency).toBe("eur");
    expect(payment.status).toBe("completed");
    expect(payment.userId).toBe(testUserId);

    // Session is marked paid
    const [dbSession] = await testDb
      .select({ status: sessions.status, maxRegens: sessions.maxRegens, regenCount: sessions.regenCount })
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("paid");
    expect(dbSession.regenCount).toBe(0);
    expect(dbSession.maxRegens).toBe(PACK_REGEN_LIMIT);
  });
});

// ---------- Idempotency ----------

describe("Idempotency E2E", () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = createTestUserId();
    await createTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  it("executes handler on first call and skips on second", async () => {
    let callCount = 0;
    const testKey = `test:idempotency:${testUserId}`;

    const result1 = await withIdempotency(testKey, "test-handler", async () => {
      callCount++;
    });

    expect(result1.skipped).toBe(false);
    expect(callCount).toBe(1);

    // Verify processed_events record exists
    const [event] = await testDb
      .select()
      .from(processedEvents)
      .where(eq(processedEvents.eventKey, testKey));

    expect(event).toBeDefined();
    expect(event.handlerName).toBe("test-handler");
    expect(event.processedAt).toBeInstanceOf(Date);

    // Call again with same key — should skip
    const result2 = await withIdempotency(testKey, "test-handler", async () => {
      callCount++;
    });

    expect(result2.skipped).toBe(true);
    expect(callCount).toBe(1); // Handler was NOT called again
  });
});

// ---------- Schema Validation ----------

describe("Schema Validation E2E", () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = createTestUserId();
    await createTestUser(testUserId);
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  it("inserts and reads back a session with all columns and correct mappings", async () => {
    const session = await createSession(testUserId, "test brief for schema validation");

    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));

    // Verify UUID was auto-generated
    expect(dbSession.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );

    // Verify timestamps auto-populated
    expect(dbSession.createdAt).toBeInstanceOf(Date);
    expect(dbSession.updatedAt).toBeInstanceOf(Date);

    // Verify integer defaults
    expect(dbSession.regenCount).toBe(0);
    expect(dbSession.maxRegens).toBe(3);
    expect(dbSession.refinementCount).toBe(0);

    // Verify nullable columns are null
    expect(dbSession.selectedDirectionId).toBeNull();
    expect(dbSession.selectedGenerationJobId).toBeNull();
    expect(dbSession.refinementHistory).toBeNull();

    // Verify string default
    expect(dbSession.status).toBe("pending");
  });

  it("verifies default values on users table", async () => {
    const [dbUser] = await testDb
      .select()
      .from(users)
      .where(eq(users.id, testUserId));

    expect(dbUser).toBeDefined();
    expect(dbUser.id).toBe(testUserId);
    expect(dbUser.createdAt).toBeInstanceOf(Date);
    expect(dbUser.updatedAt).toBeInstanceOf(Date);
  });

  it("enforces unique constraint on processed_events event_key", async () => {
    const eventKey = `test:unique:${testUserId}`;

    await testDb.insert(processedEvents).values({
      eventKey,
      handlerName: "test-unique-handler",
    });

    // Inserting duplicate event_key should throw
    await expect(
      testDb.insert(processedEvents).values({
        eventKey,
        handlerName: "test-unique-handler-duplicate",
      })
    ).rejects.toThrow();

    // Cleanup the event we inserted directly
    await testDb
      .delete(processedEvents)
      .where(eq(processedEvents.eventKey, eventKey));
  });
});
