// Must mock "server-only" before any service imports
vi.mock("server-only", () => ({}));

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  testDb,
  createTestUserId,
  createTestUser,
  cleanupTestUser,
  closeTestConnection,
  createFullSession,
  insertGenerationJob,
  insertVisualSpec,
} from "./setup";
import { sessions } from "@/server/db/schema/sessions";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import {
  refineSession,
  commitRefinement,
  composeRefinedBrief,
} from "@/server/services/refine-session";
import { selectDirection } from "@/server/services/session";

// ---------------------------------------------------------------------------
// Recovery Flow E2E
// ---------------------------------------------------------------------------

describe("Recovery Flow E2E", () => {
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
  // Task 6.2: session with directions → refine → new directions → original preserved
  // -------------------------------------------------------------------------

  it("composes refined brief from original + pills + text", () => {
    const original = "dark trap nighttime city vibes";
    const pills = ["More cinematic", "Add neon lighting"];
    const text = "Think Blade Runner meets Atlanta";

    const refined = composeRefinedBrief(original, pills, text);

    expect(refined).toContain(original);
    expect(refined).toContain("More cinematic");
    expect(refined).toContain("Add neon lighting");
    expect(refined).toContain("Think Blade Runner meets Atlanta");
  });

  it("refineSession validates session is in selectable state", async () => {
    const { sessionId } = await createFullSession(testUserId, "direction_selected");

    const result = await refineSession(
      sessionId,
      testUserId,
      ["More cinematic"],
      "Think Blade Runner"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.refinedBrief).toContain("dark trap nighttime city vibes");
    expect(result.refinedBrief).toContain("More cinematic");
    expect(result.sessionSnapshot.refinementCount).toBe(0);
    expect(result.sessionSnapshot.refinementHistory).toHaveLength(1);
    expect(result.sessionSnapshot.refinementHistory[0].pills).toEqual(["More cinematic"]);
  });

  it("refineSession rejects when session is in wrong state", async () => {
    const { sessionId } = await createFullSession(testUserId, "paid");

    const result = await refineSession(
      sessionId,
      testUserId,
      ["More cinematic"],
      ""
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STATUS");
  });

  it("refineSession rejects when session belongs to different user", async () => {
    const { sessionId } = await createFullSession(testUserId, "direction_selected");

    const otherUserId = `test-user-${crypto.randomUUID()}`;
    await testDb
      .insert(await import("@/server/db/schema/users").then((m) => m.users))
      .values({ id: otherUserId });

    try {
      const result = await refineSession(sessionId, otherUserId, [], "");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    } finally {
      await testDb
        .delete(await import("@/server/db/schema/users").then((m) => m.users))
        .where(eq((await import("@/server/db/schema/users")).users.id, otherUserId));
    }
  });

  // -------------------------------------------------------------------------
  // Task 6.3: Multiple recovery rounds track refinementCount correctly
  // -------------------------------------------------------------------------

  it("commitRefinement persists refinementCount increment and history", async () => {
    const { sessionId } = await createFullSession(testUserId, "direction_selected");

    // Simulate a refinement cycle
    const refineResult = await refineSession(
      sessionId,
      testUserId,
      ["More cinematic", "Darker palette"],
      "Think Blade Runner"
    );

    expect(refineResult.ok).toBe(true);
    if (!refineResult.ok) return;

    // Commit the refinement (as a router would do after pipeline succeeds)
    await commitRefinement(
      sessionId,
      refineResult.refinedBrief,
      refineResult.sessionSnapshot.refinementCount,
      refineResult.sessionSnapshot.refinementHistory
    );

    // Verify DB state
    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    expect(dbSession.refinementCount).toBe(1);
    expect(dbSession.status).toBe("pending"); // Reset to pending for re-interpretation
    expect(dbSession.selectedDirectionId).toBeNull();
    expect(dbSession.selectedGenerationJobId).toBeNull();

    const history = dbSession.refinementHistory as Array<{
      round: number;
      pills: string[];
      text: string;
    }>;
    expect(history).toHaveLength(1);
    expect(history[0].round).toBe(1);
    expect(history[0].pills).toEqual(["More cinematic", "Darker palette"]);
  });

  it("tracks multiple refinement rounds correctly", async () => {
    const { sessionId } = await createFullSession(testUserId, "direction_selected");

    // Round 1
    const round1 = await refineSession(
      sessionId,
      testUserId,
      ["More cinematic"],
      "Round 1 context"
    );
    expect(round1.ok).toBe(true);
    if (!round1.ok) return;

    await commitRefinement(
      sessionId,
      round1.refinedBrief,
      round1.sessionSnapshot.refinementCount,
      round1.sessionSnapshot.refinementHistory
    );

    // Advance back to direction_selected for round 2 (refineSession requires it)
    await testDb
      .update(sessions)
      .set({ status: "direction_selected" })
      .where(eq(sessions.id, sessionId));

    // Round 2
    const round2 = await refineSession(
      sessionId,
      testUserId,
      ["Even darker"],
      "Round 2 context"
    );
    expect(round2.ok).toBe(true);
    if (!round2.ok) return;

    // Round 2's snapshot has refinementCount = 1 (from DB) + the history from round 1
    expect(round2.sessionSnapshot.refinementCount).toBe(1);
    expect(round2.sessionSnapshot.refinementHistory).toHaveLength(2);

    await commitRefinement(
      sessionId,
      round2.refinedBrief,
      round2.sessionSnapshot.refinementCount,
      round2.sessionSnapshot.refinementHistory
    );

    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    expect(dbSession.refinementCount).toBe(2);
    const history = dbSession.refinementHistory as Array<{
      round: number;
      pills: string[];
    }>;
    expect(history).toHaveLength(2);
    expect(history[0].round).toBe(1);
    expect(history[1].round).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Task 6.4: Direction selection from any round works
  // -------------------------------------------------------------------------

  it("original directions persist in DB alongside new ones after refinement", async () => {
    const { sessionId, visualSpecId, generationJobId: originalJobId } =
      await createFullSession(testUserId, "selecting");

    // Simulate a second direction generation round (as would happen after refinement)
    const round2VisualSpecId = await insertVisualSpec(sessionId);
    const round2DirId = `${sessionId}-dir-r2-0`;
    const round2JobId = await insertGenerationJob(
      sessionId,
      round2VisualSpecId,
      round2DirId
    );

    // Verify both jobs exist
    const allJobs = await testDb
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.sessionId, sessionId));

    expect(allJobs).toHaveLength(2);
    const jobIds = allJobs.map((j) => j.id);
    expect(jobIds).toContain(originalJobId);
    expect(jobIds).toContain(round2JobId);

    // Can select a direction from the first round's job
    await testDb
      .update(sessions)
      .set({ status: "selecting" })
      .where(eq(sessions.id, sessionId));

    const directionId = `${sessionId}-dir-0`;
    const selectResult = await selectDirection(
      sessionId,
      testUserId,
      directionId,
      originalJobId!
    );
    expect(selectResult.ok).toBe(true);

    const [dbSession] = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(dbSession.selectedDirectionId).toBe(directionId);
    expect(dbSession.selectedGenerationJobId).toBe(originalJobId);

    // Can also select from the second round's job
    await testDb
      .update(sessions)
      .set({ status: "selecting", selectedDirectionId: null, selectedGenerationJobId: null })
      .where(eq(sessions.id, sessionId));

    const selectResult2 = await selectDirection(
      sessionId,
      testUserId,
      round2DirId,
      round2JobId
    );
    expect(selectResult2.ok).toBe(true);
  });
});
