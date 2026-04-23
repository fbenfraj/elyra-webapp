import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock DB
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockReturning = vi.fn();
const mockDeleteWhere = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return {
            onConflictDoNothing: (...cArgs: unknown[]) => {
              mockOnConflictDoNothing(...cArgs);
              return { returning: (...rArgs: unknown[]) => mockReturning(...rArgs) };
            },
          };
        },
      };
    },
    delete: () => ({
      where: (...args: unknown[]) => mockDeleteWhere(...args),
    }),
  },
}));

vi.mock("@/server/db/schema/processed-events", () => ({
  processedEvents: {
    id: "id",
    eventKey: "event_key",
    handlerName: "handler_name",
  },
}));

describe("withIdempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes handler and returns skipped: false on first call", async () => {
    // INSERT succeeds — row was claimed
    mockReturning.mockResolvedValueOnce([{ id: "new-id" }]);

    const handler = vi.fn().mockResolvedValue(undefined);

    const { withIdempotency } = await import("@/server/services/idempotency");
    const result = await withIdempotency("test-key-1", "testHandler", handler);

    expect(result).toEqual({ skipped: false });
    expect(handler).toHaveBeenCalledOnce();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "test-key-1",
        handlerName: "testHandler",
      })
    );
  });

  it("skips handler and returns skipped: true when key already exists", async () => {
    // INSERT conflict — no row returned
    mockReturning.mockResolvedValueOnce([]);

    const handler = vi.fn().mockResolvedValue(undefined);

    const { withIdempotency } = await import("@/server/services/idempotency");
    const result = await withIdempotency("test-key-1", "testHandler", handler);

    expect(result).toEqual({ skipped: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes claim and re-throws when handler fails", async () => {
    // INSERT succeeds — row was claimed
    mockReturning.mockResolvedValueOnce([{ id: "new-id" }]);

    const handler = vi.fn().mockRejectedValue(new Error("handler failed"));

    const { withIdempotency } = await import("@/server/services/idempotency");

    await expect(
      withIdempotency("test-key-fail", "testHandler", handler)
    ).rejects.toThrow("handler failed");

    expect(handler).toHaveBeenCalledOnce();
    // Claim should be deleted so retries can re-execute
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("executes different keys independently", async () => {
    // First key — claimed
    mockReturning.mockResolvedValueOnce([{ id: "id-a" }]);
    const handler1 = vi.fn().mockResolvedValue(undefined);

    const { withIdempotency } = await import("@/server/services/idempotency");
    const result1 = await withIdempotency("key-a", "testHandler", handler1);

    expect(result1).toEqual({ skipped: false });
    expect(handler1).toHaveBeenCalledOnce();

    vi.clearAllMocks();

    // Second key — also claimed
    mockReturning.mockResolvedValueOnce([{ id: "id-b" }]);
    const handler2 = vi.fn().mockResolvedValue(undefined);

    const result2 = await withIdempotency("key-b", "testHandler", handler2);

    expect(result2).toEqual({ skipped: false });
    expect(handler2).toHaveBeenCalledOnce();
  });

  it("stores handler name correctly", async () => {
    mockReturning.mockResolvedValueOnce([{ id: "new-id" }]);

    const handler = vi.fn().mockResolvedValue(undefined);

    const { withIdempotency } = await import("@/server/services/idempotency");
    await withIdempotency("test-key-name", "mySpecificHandler", handler);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "test-key-name",
        handlerName: "mySpecificHandler",
      })
    );
  });
});
