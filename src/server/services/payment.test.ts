import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

// Mock Stripe
const mockCheckoutSessionsCreate = vi.fn();
vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockCheckoutSessionsCreate,
        },
      },
    })),
  };
});

// Mock DB — supports multiple chained select/from/where calls
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockSelectWhere = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockSetWhere = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return { values: (...vArgs: unknown[]) => { mockValues(...vArgs); return { returning: vi.fn(), onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn() }) }; } };
    },
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
          return { where: mockSetWhere };
        },
      };
    },
  },
}));

vi.mock("@/server/db/schema/payments", () => ({
  payments: { id: "id", sessionId: "session_id", stripeSessionId: "stripe_session_id" },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: { id: "id", userId: "user_id", status: "status", regenCount: "regen_count", maxRegens: "max_regens" },
}));

vi.mock("@/config/pricing", () => ({
  PACK_PRICE_CENTS: 700,
  PACK_CURRENCY: "eur",
  PACK_REGEN_LIMIT: 3,
}));

// Mock idempotency helper — executes the handler callback immediately by default
const mockWithIdempotency = vi.fn(
  async (_eventKey: string, _handlerName: string, handler: () => Promise<void>) => {
    await handler();
    return { skipped: false };
  }
);

vi.mock("@/server/services/idempotency", () => ({
  withIdempotency: (...args: unknown[]) => mockWithIdempotency(...args as [string, string, () => Promise<void>]),
}));

describe("payment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  });

  describe("createCheckoutSession", () => {
    it("creates a Stripe checkout session with correct params", async () => {
      // Mock: session exists and belongs to user, status is direction_selected
      mockSelectWhere.mockResolvedValue([
        { id: "session-123", userId: "user-456", status: "direction_selected" },
      ]);

      mockCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/test-session",
      });

      const { createCheckoutSession } = await import("@/server/services/payment");
      const result = await createCheckoutSession("session-123", "user-456");

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: "eur",
                unit_amount: 700,
                product_data: { name: "Elyra Release Pack" },
              }),
              quantity: 1,
            }),
          ],
          success_url: expect.stringContaining("session_id=session-123"),
          cancel_url: expect.stringContaining("session_id=session-123"),
          metadata: { sessionId: "session-123", userId: "user-456" },
        })
      );

      expect(result).toEqual({
        checkoutUrl: "https://checkout.stripe.com/test-session",
      });
    });

    it("throws when session does not belong to user", async () => {
      mockSelectWhere.mockResolvedValue([
        { id: "session-123", userId: "other-user", status: "direction_selected" },
      ]);

      const { createCheckoutSession } = await import("@/server/services/payment");
      await expect(createCheckoutSession("session-123", "user-456")).rejects.toThrow(
        "Session not found"
      );
    });

    it("throws when session status is not direction_selected", async () => {
      mockSelectWhere.mockResolvedValue([
        { id: "session-123", userId: "user-456", status: "pending" },
      ]);

      const { createCheckoutSession } = await import("@/server/services/payment");
      await expect(createCheckoutSession("session-123", "user-456")).rejects.toThrow(
        "Session is not ready for payment"
      );
    });
  });

  describe("handleWebhookEvent", () => {
    it("inserts payment record and updates session on checkout.session.completed", async () => {
      const { handleWebhookEvent } = await import("@/server/services/payment");

      const event = {
        type: "checkout.session.completed" as const,
        data: {
          object: {
            id: "cs_test_123",
            metadata: { sessionId: "session-123", userId: "user-456" },
            amount_total: 700,
            currency: "eur",
          },
        },
      };

      await handleWebhookEvent(event as unknown as Stripe.Event);

      expect(mockWithIdempotency).toHaveBeenCalledWith(
        "stripe:checkout:cs_test_123",
        "handleStripeCheckout",
        expect.any(Function)
      );
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session-123",
          userId: "user-456",
          stripeSessionId: "cs_test_123",
          amountCents: 700,
          currency: "eur",
          status: "completed",
        })
      );
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "paid",
        })
      );
    });

    it("delegates idempotency to withIdempotency helper", async () => {
      // When withIdempotency reports skipped, the handler is not called
      mockWithIdempotency.mockResolvedValueOnce({ skipped: true });

      const { handleWebhookEvent } = await import("@/server/services/payment");

      const event = {
        type: "checkout.session.completed" as const,
        data: {
          object: {
            id: "cs_test_123",
            metadata: { sessionId: "session-123", userId: "user-456" },
            amount_total: 700,
            currency: "eur",
          },
        },
      };

      await handleWebhookEvent(event as unknown as Stripe.Event);

      expect(mockWithIdempotency).toHaveBeenCalledWith(
        "stripe:checkout:cs_test_123",
        "handleStripeCheckout",
        expect.any(Function)
      );
      // Handler was not called because withIdempotency skipped it
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("ignores non-checkout events", async () => {
      const { handleWebhookEvent } = await import("@/server/services/payment");

      const event = {
        type: "payment_intent.succeeded" as const,
        data: { object: {} },
      };

      await handleWebhookEvent(event as unknown as Stripe.Event);

      expect(mockWithIdempotency).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("ignores events missing metadata", async () => {
      const { handleWebhookEvent } = await import("@/server/services/payment");

      const event = {
        type: "checkout.session.completed" as const,
        data: {
          object: {
            id: "cs_test_no_meta",
            metadata: {},
            amount_total: 700,
            currency: "eur",
          },
        },
      };

      await handleWebhookEvent(event as unknown as Stripe.Event);

      expect(mockWithIdempotency).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
