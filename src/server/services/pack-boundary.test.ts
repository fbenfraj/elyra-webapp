import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock Stripe (required by payment.ts module)
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: vi.fn() } },
  })),
}));

// Mock DB
const mockSelectWhere = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockSetWhere = vi.fn();

/** What `db.update().set().where().returning()` resolves to */
let updateReturningResult: unknown[] = [{ id: "session-1" }];
const mockUpdateReturning = vi.fn().mockImplementation(() =>
  Promise.resolve(updateReturningResult)
);

vi.mock("@/server/db", () => ({
  db: {
    insert: () => ({ values: () => ({ returning: vi.fn(), onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn() }) }) }),
    delete: () => ({ where: vi.fn() }),
    select: () => ({
      from: () => ({
        where: (...args: unknown[]) => mockSelectWhere(...args),
      }),
    }),
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: unknown[]) => {
          mockSet(...sArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockSetWhere(...wArgs);
              return { returning: mockUpdateReturning };
            },
          };
        },
      };
    },
  },
}));

vi.mock("@/server/db/schema/payments", () => ({
  payments: { id: "id", sessionId: "session_id", stripeSessionId: "stripe_session_id" },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
    status: "status",
    regenCount: "regen_count",
    maxRegens: "max_regens",
  },
}));

vi.mock("@/config/pricing", () => ({
  PACK_PRICE_CENTS: 700,
  PACK_CURRENCY: "eur",
  PACK_REGEN_LIMIT: 3,
}));

// Mock idempotency helper — executes the handler callback immediately
vi.mock("@/server/services/idempotency", () => ({
  withIdempotency: vi.fn(
    async (_eventKey: string, _handlerName: string, handler: () => Promise<void>) => {
      await handler();
      return { skipped: false };
    }
  ),
}));

describe("pack boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateReturningResult = [{ id: "session-1" }];
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  });

  describe("checkPackBoundary", () => {
    it("returns canRegenerate: true for paid session with regens remaining", async () => {
      mockSelectWhere.mockResolvedValue([
        { status: "paid", userId: "user-1", regenCount: 1, maxRegens: 3 },
      ]);

      const { checkPackBoundary } = await import("@/server/services/payment");
      const result = await checkPackBoundary("session-1", "user-1");

      expect(result).toEqual({
        isPaid: true,
        canRegenerate: true,
        regenCount: 1,
        maxRegens: 3,
      });
    });

    it("returns canRegenerate: false when regen_count >= max_regens", async () => {
      mockSelectWhere.mockResolvedValue([
        { status: "paid", userId: "user-1", regenCount: 3, maxRegens: 3 },
      ]);

      const { checkPackBoundary } = await import("@/server/services/payment");
      const result = await checkPackBoundary("session-1", "user-1");

      expect(result).toEqual({
        isPaid: true,
        canRegenerate: false,
        regenCount: 3,
        maxRegens: 3,
      });
    });

    it("returns isPaid: false for unpaid sessions", async () => {
      mockSelectWhere.mockResolvedValue([
        { status: "direction_selected", userId: "user-1", regenCount: 0, maxRegens: 3 },
      ]);

      const { checkPackBoundary } = await import("@/server/services/payment");
      const result = await checkPackBoundary("session-1", "user-1");

      expect(result).toEqual({
        isPaid: false,
        canRegenerate: false,
        regenCount: 0,
        maxRegens: 3,
      });
    });

    it("throws when session does not belong to user", async () => {
      mockSelectWhere.mockResolvedValue([
        { status: "paid", userId: "other-user", regenCount: 0, maxRegens: 3 },
      ]);

      const { checkPackBoundary } = await import("@/server/services/payment");
      await expect(checkPackBoundary("session-1", "user-1")).rejects.toThrow(
        "Session not found"
      );
    });

    it("throws when session does not exist", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const { checkPackBoundary } = await import("@/server/services/payment");
      await expect(checkPackBoundary("nonexistent", "user-1")).rejects.toThrow(
        "Session not found"
      );
    });
  });

  describe("incrementRegenCount", () => {
    it("calls update with increment expression when session is in valid state", async () => {
      updateReturningResult = [{ id: "session-1" }];
      const { incrementRegenCount } = await import("@/server/services/payment");
      await incrementRegenCount("session-1");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
    });

    it("throws when session is not in a valid state for regen", async () => {
      updateReturningResult = []; // 0 rows — pre-condition failed
      const { incrementRegenCount } = await import("@/server/services/payment");
      await expect(incrementRegenCount("session-1")).rejects.toThrow(
        "not in a valid state"
      );
    });
  });

  describe("webhook sets maxRegens from config", () => {
    it("sets maxRegens to PACK_REGEN_LIMIT when marking session as paid", async () => {
      const { handleWebhookEvent } = await import("@/server/services/payment");

      const event = {
        type: "checkout.session.completed" as const,
        data: {
          object: {
            id: "cs_test_regen",
            metadata: { sessionId: "session-1", userId: "user-1" },
            amount_total: 700,
            currency: "eur",
          },
        },
      };

      await handleWebhookEvent(event as unknown as import("stripe").default.Event);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "paid",
          maxRegens: 3,
          regenCount: 0,
        })
      );
    });
  });
});
