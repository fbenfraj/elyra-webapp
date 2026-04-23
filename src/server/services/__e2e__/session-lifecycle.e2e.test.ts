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
import { createSession, updateSessionStatus, selectDirection } from "@/server/services/session";
import {
  handleWebhookEvent,
  checkPackBoundary,
  incrementRegenCount,
} from "@/server/services/payment";
import { withIdempotency } from "@/server/services/idempotency";
import { PACK_REGEN_LIMIT } from "@/config/pricing";

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
    expect(dbSession.selectedDirectionIndex).toBeNull();
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

    // interpreting -> generating
    await updateSessionStatus(session.id, "generating");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("generating");

    // generating -> complete
    await updateSessionStatus(session.id, "complete");
    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("complete");

    // complete -> direction_selected via selectDirection
    const result = await selectDirection(session.id, testUserId, 1, "gen-job-123");
    expect(result.ok).toBe(true);

    [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(dbSession.status).toBe("direction_selected");
    expect(dbSession.selectedDirectionIndex).toBe(1);
    expect(dbSession.selectedGenerationJobId).toBe("gen-job-123");
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
    } as Stripe.Event;

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
    } as Stripe.Event;

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
    } as Stripe.Event;

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
    expect(dbSession.selectedDirectionIndex).toBeNull();
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
