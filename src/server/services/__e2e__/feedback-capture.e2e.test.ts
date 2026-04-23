// Must mock "server-only" before any service imports
vi.mock("server-only", () => ({}));

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { eq, and, desc } from "drizzle-orm";
import {
  testDb,
  createTestUserId,
  createTestUser,
  cleanupTestUser,
  closeTestConnection,
  createFullSession,
  insertGenerationAttempt,
} from "./setup";
import { feedback as feedbackTable } from "@/server/db/schema/feedback";
import { sessionEvents } from "@/server/db/schema/session-events";
import { users } from "@/server/db/schema/users";
import { toggleLike, getLikedAttemptIds } from "@/server/services/feedback";
import { captureEvent, captureScreenTime } from "@/server/services/event-capture";

// ---------------------------------------------------------------------------
// Feedback Capture E2E
// ---------------------------------------------------------------------------

describe("Feedback Capture E2E", () => {
  let testUserId: string;

  beforeEach(async () => {
    testUserId = createTestUserId();
    await createTestUser(testUserId);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  afterAll(async () => {
    await closeTestConnection();
  });

  // -------------------------------------------------------------------------
  // Task 7.2: Like toggle → feedback record created → unlike → new "unlike" record
  // -------------------------------------------------------------------------

  it("creates a like feedback record when toggling like on an unevaluated attempt", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "generating_images"
    );
    const attemptId = await insertGenerationAttempt(sessionId, generationJobId!);

    const result = await toggleLike(testUserId, sessionId, attemptId);

    expect(result.liked).toBe(true);

    // Verify feedback row in DB
    const rows = await testDb
      .select()
      .from(feedbackTable)
      .where(
        and(
          eq(feedbackTable.userId, testUserId),
          eq(feedbackTable.generationAttemptId, attemptId)
        )
      )
      .orderBy(desc(feedbackTable.createdAt));

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("like");
    expect(rows[0].sessionId).toBe(sessionId);
    expect(rows[0].userId).toBe(testUserId);
  });

  it("creates an unlike feedback record when toggling like twice", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "generating_images"
    );
    const attemptId = await insertGenerationAttempt(sessionId, generationJobId!);

    // Like
    const likeResult = await toggleLike(testUserId, sessionId, attemptId);
    expect(likeResult.liked).toBe(true);

    // Unlike
    const unlikeResult = await toggleLike(testUserId, sessionId, attemptId);
    expect(unlikeResult.liked).toBe(false);

    // Verify two rows — the second being "unlike"
    const rows = await testDb
      .select()
      .from(feedbackTable)
      .where(
        and(
          eq(feedbackTable.userId, testUserId),
          eq(feedbackTable.generationAttemptId, attemptId)
        )
      )
      .orderBy(desc(feedbackTable.createdAt));

    expect(rows).toHaveLength(2);
    expect(rows[0].action).toBe("unlike"); // most recent
    expect(rows[1].action).toBe("like");
  });

  it("getLikedAttemptIds returns only currently liked attempts", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "generating_images"
    );
    const attempt1Id = await insertGenerationAttempt(sessionId, generationJobId!);
    const attempt2Id = await insertGenerationAttempt(sessionId, generationJobId!);
    const attempt3Id = await insertGenerationAttempt(sessionId, generationJobId!);

    // Like attempts 1 and 2
    await toggleLike(testUserId, sessionId, attempt1Id);
    await toggleLike(testUserId, sessionId, attempt2Id);

    // Like and then unlike attempt 3
    await toggleLike(testUserId, sessionId, attempt3Id);
    await toggleLike(testUserId, sessionId, attempt3Id);

    const likedIds = await getLikedAttemptIds(testUserId, sessionId);

    expect(likedIds).toContain(attempt1Id);
    expect(likedIds).toContain(attempt2Id);
    expect(likedIds).not.toContain(attempt3Id); // was unliked
    expect(likedIds).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Task 7.3: Session events captured for direction selection, image selection, screen views
  // -------------------------------------------------------------------------

  it("captures direction_selected event in session_events", async () => {
    const { sessionId } = await createFullSession(testUserId, "selecting");

    await captureEvent(testUserId, sessionId, "direction_selected", {
      directionId: `${sessionId}-dir-0`,
      generationJobId: "test-job-id",
    });

    const rows = await testDb
      .select()
      .from(sessionEvents)
      .where(
        and(
          eq(sessionEvents.sessionId, sessionId),
          eq(sessionEvents.action, "direction_selected")
        )
      );

    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(testUserId);
    expect(rows[0].sessionId).toBe(sessionId);
    expect(rows[0].action).toBe("direction_selected");
    expect(rows[0].payload).toMatchObject({
      directionId: `${sessionId}-dir-0`,
    });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it("captures image_selected event in session_events", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "generating_images"
    );
    const attemptId = await insertGenerationAttempt(sessionId, generationJobId!);

    await captureEvent(testUserId, sessionId, "image_selected", {
      attemptId,
      batchNumber: 1,
    });

    const rows = await testDb
      .select()
      .from(sessionEvents)
      .where(
        and(
          eq(sessionEvents.sessionId, sessionId),
          eq(sessionEvents.action, "image_selected")
        )
      );

    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ attemptId, batchNumber: 1 });
  });

  it("captures screen_exited events via captureScreenTime", async () => {
    const { sessionId } = await createFullSession(testUserId, "selecting");

    await captureScreenTime(testUserId, sessionId, "direction_selection", 5000);

    const rows = await testDb
      .select()
      .from(sessionEvents)
      .where(
        and(
          eq(sessionEvents.sessionId, sessionId),
          eq(sessionEvents.action, "screen_exited")
        )
      );

    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({
      screen: "direction_selection",
      durationMs: 5000,
    });
  });

  it("captures multiple events for a session", async () => {
    const { sessionId } = await createFullSession(testUserId, "selecting");

    await captureEvent(testUserId, sessionId, "brief_submitted", { briefLength: 42 });
    await captureEvent(testUserId, sessionId, "direction_viewed", { directionIndex: 0 });
    await captureEvent(testUserId, sessionId, "direction_selected", { directionId: "dir-0" });

    const rows = await testDb
      .select()
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId));

    expect(rows).toHaveLength(3);
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("brief_submitted");
    expect(actions).toContain("direction_viewed");
    expect(actions).toContain("direction_selected");
  });

  // -------------------------------------------------------------------------
  // Task 7.4: RLS scoping — user A cannot read user B's feedback
  // -------------------------------------------------------------------------

  it("getLikedAttemptIds is scoped to userId — does not return other users' likes", async () => {
    const { sessionId, generationJobId } = await createFullSession(
      testUserId,
      "generating_images"
    );
    const attemptId = await insertGenerationAttempt(sessionId, generationJobId!);

    // Create a second user and like the same attempt
    const otherUserId = createTestUserId();
    await createTestUser(otherUserId);

    try {
      // Other user likes the attempt (using same sessionId — they'd need access in real app,
      // but service layer only checks userId in queries)
      await toggleLike(otherUserId, sessionId, attemptId);
      await toggleLike(testUserId, sessionId, attemptId);

      // testUserId should see their own like
      const myLikes = await getLikedAttemptIds(testUserId, sessionId);
      expect(myLikes).toContain(attemptId);

      // otherUserId should see their own like
      const otherLikes = await getLikedAttemptIds(otherUserId, sessionId);
      expect(otherLikes).toContain(attemptId);

      // Results are independent — no cross-user contamination in service queries
      // (RLS enforcement at the DB level is separate from service-level scoping)
      expect(myLikes).toHaveLength(1);
      expect(otherLikes).toHaveLength(1);
    } finally {
      // Clean up the other user's feedback and user row
      await testDb
        .delete(feedbackTable)
        .where(eq(feedbackTable.userId, otherUserId));
      await testDb.delete(users).where(eq(users.id, otherUserId));
    }
  });
});
