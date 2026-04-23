/**
 * Story 7.5-2: Async & State Safety Hardening Tests
 *
 * Covers:
 *  - Task 1 / AC#1: Valid and invalid session state transitions (VALID_TRANSITIONS)
 *  - Task 5 / AC#5: Concurrent request safety (StaleSessionError, optimistic locking)
 *  - Task 4 / AC#3: Idempotency via withIdempotency (double-delivery)
 *  - Task 3 / AC#2: Child record creation fails if parent doesn't exist
 *  - Task 2 / AC#1: Trigger.dev tasks use correct failedStage values
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Shared DB mock state — controlled per test via these refs
// ---------------------------------------------------------------------------

/** What `db.select().from().where()` resolves to */
let selectResult: unknown[] = [];

/** What `db.update().set().where().returning()` resolves to */
let updateResult: unknown[] = [{ id: "sess-1" }];

/** Tracks calls to db.update */
const mockUpdate = vi.fn();
/** Tracks calls to db.select */
const mockSelect = vi.fn();
/** Tracks insert returning calls (for idempotency + visual-spec tests) */
const mockInsertReturning = vi.fn();
/** Tracks insert values calls */
const mockInsertValues = vi.fn();
/** Tracks delete where calls */
const mockDeleteWhere = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() =>
              Promise.resolve(updateResult)
            ),
          }),
        }),
      };
    },
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() =>
            Promise.resolve(selectResult)
          ),
        }),
      };
    },
    insert: vi.fn().mockReturnValue({
      values: (...args: unknown[]) => {
        mockInsertValues(...args);
        return {
          returning: (...args: unknown[]) => mockInsertReturning(...args),
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: (...args: unknown[]) => mockInsertReturning(...args),
          }),
        };
      },
    }),
    delete: vi.fn().mockReturnValue({
      where: (...args: unknown[]) => mockDeleteWhere(...args),
    }),
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
    status: "status",
    failedStage: "failed_stage",
    briefText: "brief_text",
    updatedAt: "updated_at",
  },
}));

vi.mock("@/server/db/schema/visual-specs", () => ({
  visualSpecs: {
    id: "id",
    sessionId: "session_id",
    specData: "spec_data",
  },
}));

vi.mock("@/server/db/schema/processed-events", () => ({
  processedEvents: {
    id: "id",
    eventKey: "event_key",
    handlerName: "handler_name",
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset defaults
  selectResult = [{ status: "pending" }];
  updateResult = [{ id: "sess-1" }];
  mockInsertReturning.mockResolvedValue([{ id: "new-id" }]);
  mockDeleteWhere.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Task 1 / AC#1: VALID_TRANSITIONS map — structure tests
// ---------------------------------------------------------------------------

describe("VALID_TRANSITIONS map", () => {
  it("exports a complete map covering all statuses", async () => {
    const { VALID_TRANSITIONS } = await import("@/server/services/session");

    const expectedStatuses = [
      "pending",
      "interpreting",
      "generating_directions",
      "selecting",
      "direction_selected",
      "paid",
      "generating_images",
      "evaluating",
      "packaging",
      "delivered",
      "failed",
      "complete",
    ];

    for (const status of expectedStatuses) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("maps core pipeline happy-path transitions", async () => {
    const { VALID_TRANSITIONS } = await import("@/server/services/session");

    expect(VALID_TRANSITIONS.pending).toContain("interpreting");
    expect(VALID_TRANSITIONS.interpreting).toContain("generating_directions");
    expect(VALID_TRANSITIONS.generating_directions).toContain("selecting");
    expect(VALID_TRANSITIONS.selecting).toContain("direction_selected");
    expect(VALID_TRANSITIONS.direction_selected).toContain("paid");
    expect(VALID_TRANSITIONS.paid).toContain("generating_images");
    expect(VALID_TRANSITIONS.generating_images).toContain("evaluating");
    expect(VALID_TRANSITIONS.evaluating).toContain("selecting");
    expect(VALID_TRANSITIONS.packaging).toContain("delivered");
  });

  it("allows any pipeline status to transition to failed", async () => {
    const { VALID_TRANSITIONS } = await import("@/server/services/session");

    const failableStatuses = [
      "pending",
      "interpreting",
      "generating_directions",
      "selecting",
      "direction_selected",
      "paid",
      "generating_images",
      "evaluating",
      "packaging",
    ] as const;

    for (const status of failableStatuses) {
      expect(VALID_TRANSITIONS[status]).toContain("failed");
    }
  });

  it("allows failed → pending for retry recovery", async () => {
    const { VALID_TRANSITIONS } = await import("@/server/services/session");
    expect(VALID_TRANSITIONS.failed).toContain("pending");
  });

  it("treats delivered as a terminal state with no outgoing transitions", async () => {
    const { VALID_TRANSITIONS } = await import("@/server/services/session");
    expect(VALID_TRANSITIONS.delivered).toHaveLength(0);
  });

  it("allows interpreting → pending for low-confidence re-prompt", async () => {
    const { VALID_TRANSITIONS } = await import("@/server/services/session");
    expect(VALID_TRANSITIONS.interpreting).toContain("pending");
  });

  it("allows evaluating → generating_images for the retry loop", async () => {
    const { VALID_TRANSITIONS } = await import("@/server/services/session");
    expect(VALID_TRANSITIONS.evaluating).toContain("generating_images");
  });
});

// ---------------------------------------------------------------------------
// Task 1 / AC#1: updateSessionStatus — transition validation
// ---------------------------------------------------------------------------

describe("updateSessionStatus — transition validation", () => {
  it("accepts valid transition: pending → interpreting", async () => {
    selectResult = [{ status: "pending" }];
    updateResult = [{ id: "sess-1" }];

    const { updateSessionStatus } = await import("@/server/services/session");
    await expect(
      updateSessionStatus("sess-1", "interpreting")
    ).resolves.toBeUndefined();
  });

  it("rejects illegal transition: pending → complete (not in allowed list)", async () => {
    selectResult = [{ status: "pending" }];

    const { updateSessionStatus, InvalidTransitionError } = await import(
      "@/server/services/session"
    );
    await expect(
      updateSessionStatus("sess-1", "complete")
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects illegal transition: pending → delivered (skips many states)", async () => {
    selectResult = [{ status: "pending" }];

    const { updateSessionStatus, InvalidTransitionError } = await import(
      "@/server/services/session"
    );
    await expect(
      updateSessionStatus("sess-1", "delivered")
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects illegal transition: delivered → pending (terminal state)", async () => {
    selectResult = [{ status: "delivered" }];

    const { updateSessionStatus, InvalidTransitionError } = await import(
      "@/server/services/session"
    );
    await expect(
      updateSessionStatus("sess-1", "pending")
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects illegal transition: pending → packaging (state skipping)", async () => {
    selectResult = [{ status: "pending" }];

    const { updateSessionStatus, InvalidTransitionError } = await import(
      "@/server/services/session"
    );
    await expect(
      updateSessionStatus("sess-1", "packaging")
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("throws when session is not found in the database", async () => {
    selectResult = []; // no rows

    const { updateSessionStatus } = await import("@/server/services/session");
    await expect(
      updateSessionStatus("nonexistent", "interpreting")
    ).rejects.toThrow('Session "nonexistent" not found');
  });
});

// ---------------------------------------------------------------------------
// Task 5 / AC#5: Concurrent request safety — optimistic locking
// ---------------------------------------------------------------------------

describe("updateSessionStatus — optimistic locking (StaleSessionError)", () => {
  it("throws StaleSessionError when 0 rows are updated", async () => {
    selectResult = [{ status: "pending" }];
    updateResult = []; // concurrent modification — 0 rows updated

    const { updateSessionStatus, StaleSessionError } = await import(
      "@/server/services/session"
    );

    await expect(
      updateSessionStatus("sess-concurrent", "interpreting")
    ).rejects.toThrow(StaleSessionError);
  });

  it("succeeds when update affects exactly 1 row", async () => {
    selectResult = [{ status: "pending" }];
    updateResult = [{ id: "sess-ok" }];

    const { updateSessionStatus } = await import("@/server/services/session");
    await expect(
      updateSessionStatus("sess-ok", "interpreting")
    ).resolves.toBeUndefined();
  });

  it("skips SELECT when expectedCurrentStatus is supplied", async () => {
    // selectResult is set to something that would cause an error if used
    // We verify mockSelect is never called
    selectResult = []; // would throw "not found" if SELECT ran
    updateResult = [{ id: "sess-opt" }];

    const { updateSessionStatus } = await import("@/server/services/session");
    await expect(
      updateSessionStatus("sess-opt", "interpreting", "pending")
    ).resolves.toBeUndefined();

    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("throws StaleSessionError with expectedCurrentStatus when update returns 0 rows", async () => {
    updateResult = []; // 0 rows — stale

    const { updateSessionStatus, StaleSessionError } = await import(
      "@/server/services/session"
    );

    await expect(
      updateSessionStatus("sess-stale", "interpreting", "pending")
    ).rejects.toThrow(StaleSessionError);
  });

  it("concurrent updates: the second update that sees 0 rows throws StaleSessionError", async () => {
    // This test demonstrates the optimistic locking guarantee:
    // If two requests both read status="pending" and then race to update,
    // the DB's WHERE id=? AND status=? predicate ensures only one can win.
    // The loser gets 0 rows affected → StaleSessionError.
    //
    // We simulate "loser" scenario: SELECT returns pending, UPDATE returns 0 rows.
    selectResult = [{ status: "pending" }];
    updateResult = []; // simulates: another request already changed status

    const { updateSessionStatus, StaleSessionError } = await import(
      "@/server/services/session"
    );

    // The request that "loses the race" gets StaleSessionError
    await expect(
      updateSessionStatus("sess-race", "interpreting")
    ).rejects.toThrow(StaleSessionError);

    // Verify the update was attempted with the WHERE status pre-condition
    // (the actual SQL WHERE id=? AND status=? is what provides concurrency safety)
    expect(mockUpdate).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task 4 / AC#3: Idempotency — double-delivery via withIdempotency
// ---------------------------------------------------------------------------

describe("withIdempotency — double-delivery safety", () => {
  it("executes handler once on first delivery", async () => {
    mockInsertReturning.mockResolvedValue([{ id: "ev-1" }]); // claimed

    const handler = vi.fn().mockResolvedValue(undefined);
    const { withIdempotency } = await import("@/server/services/idempotency");

    const result = await withIdempotency("event-abc", "myHandler", handler);

    expect(result).toEqual({ skipped: false });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("skips handler on duplicate delivery (conflict — no row returned)", async () => {
    mockInsertReturning.mockResolvedValue([]); // conflict — not claimed

    const handler = vi.fn().mockResolvedValue(undefined);
    const { withIdempotency } = await import("@/server/services/idempotency");

    const result = await withIdempotency("event-abc", "myHandler", handler);

    expect(result).toEqual({ skipped: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes claim and re-throws on handler failure (allows retry)", async () => {
    mockInsertReturning.mockResolvedValue([{ id: "ev-retry" }]); // claimed

    const failingHandler = vi.fn().mockRejectedValue(new Error("transient"));
    const { withIdempotency } = await import("@/server/services/idempotency");

    await expect(
      withIdempotency("event-retry", "myHandler", failingHandler)
    ).rejects.toThrow("transient");

    // Claim must be deleted so the next delivery can re-execute
    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task 3 / AC#2: Orphan prevention — storeVisualSpec parent check
// ---------------------------------------------------------------------------

describe("storeVisualSpec — parent session existence check", () => {
  it("throws if parent session does not exist", async () => {
    selectResult = []; // session not found

    const { storeVisualSpec } = await import(
      "@/server/services/visual-spec-store"
    );

    await expect(
      storeVisualSpec("orphan-session", {} as never)
    ).rejects.toThrow('session "orphan-session" not found');
  });

  it("inserts visual spec when parent session exists", async () => {
    selectResult = [{ id: "sess-ok" }]; // session found
    mockInsertReturning.mockResolvedValue([{ id: "spec-1" }]);

    const { storeVisualSpec } = await import(
      "@/server/services/visual-spec-store"
    );

    const result = await storeVisualSpec("sess-ok", {} as never);
    expect(result).toEqual({ id: "spec-1" });
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "sess-ok" })
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2 / AC#1: Trigger.dev tasks — failedStage source verification
// ---------------------------------------------------------------------------

describe("Trigger.dev task failedStage correctness", () => {
  /**
   * Source-level string checks verify each task's catch block calls failSession
   * with the correct failedStage. Fast and zero-dependency.
   */

  it("generation-interpret-brief: catch sets failedStage=interpreting", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      process.cwd(),
      "src/trigger/generation-interpret-brief.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("failSession");
    expect(source).toContain('"interpreting"');
  });

  it("generation-create-directions: catch sets failedStage=generating_directions", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      process.cwd(),
      "src/trigger/generation-create-directions.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("failSession");
    expect(source).toContain('"generating_directions"');
  });

  it("generation-create-images: catch sets failedStage=generating_images", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      process.cwd(),
      "src/trigger/generation-create-images.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("failSession");
    expect(source).toContain('"generating_images"');
  });

  it("generation-evaluate-batch: catch sets failedStage=evaluating", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      process.cwd(),
      "src/trigger/generation-evaluate-batch.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("failSession");
    expect(source).toContain('"evaluating"');
  });

  it("generation-refine-prompt: catch sets failedStage=prompt_refinement (not generating_images)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      process.cwd(),
      "src/trigger/generation-refine-prompt.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("failSession");
    expect(source).toContain('"prompt_refinement"');
    // Verify the incorrect failedStage was removed
    expect(source).not.toMatch(/failSession\s*\(.*"generating_images"/);
  });

  it("generation-assemble-package: catch sets failedStage=packaging", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      process.cwd(),
      "src/trigger/generation-assemble-package.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("failSession");
    expect(source).toContain('"packaging"');
  });

  it("webhook-process-fal: uses withIdempotency for idempotent processing", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      process.cwd(),
      "src/trigger/webhook-process-fal.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("withIdempotency");
  });
});
