import "server-only";

import Stripe from "stripe";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema/payments";
import { sessions } from "@/server/db/schema/sessions";
import { and, eq, sql } from "drizzle-orm";
import { PACK_PRICE_CENTS, PACK_CURRENCY, PACK_REGEN_LIMIT } from "@/config/pricing";
import { withIdempotency } from "@/server/services/idempotency";
import { promoteUserToPremium, isPremiumUser } from "@/server/services/user";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createCheckoutSession(sessionId: string, userId: string) {
  // Verify session exists and belongs to the authenticated user
  const [session] = await db
    .select({ id: sessions.id, userId: sessions.userId, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.userId !== userId) {
    throw new Error("Session not found");
  }

  if (session.status !== "direction_selected") {
    throw new Error("Session is not ready for payment");
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3847";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: PACK_CURRENCY,
          product_data: { name: "Elyra Release Pack" },
          unit_amount: PACK_PRICE_CENTS,
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/generate/${sessionId}?payment=success`,
    cancel_url: `${baseUrl}/generate/${sessionId}?payment=cancelled`,
    metadata: { sessionId, userId },
  });

  return { checkoutUrl: checkoutSession.url };
}

export async function handleWebhookEvent(event: Stripe.Event) {
  if (event.type !== "checkout.session.completed") {
    return;
  }

  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  const sessionId = checkoutSession.metadata?.sessionId;
  const userId = checkoutSession.metadata?.userId;

  if (!sessionId || !userId) {
    return;
  }

  await withIdempotency(`stripe:checkout:${checkoutSession.id}`, "handleStripeCheckout", async () => {
    // ON CONFLICT handles retry after partial failure: if a prior attempt
    // inserted the payment row but failed before completing, the retry
    // skips the insert and proceeds to the session update.
    await db.insert(payments).values({
      sessionId,
      userId,
      stripeSessionId: checkoutSession.id,
      amountCents: checkoutSession.amount_total ?? PACK_PRICE_CENTS,
      currency: checkoutSession.currency ?? PACK_CURRENCY,
      status: "completed",
    }).onConflictDoNothing({ target: payments.stripeSessionId });

    // Pre-condition: session must be in direction_selected to transition to paid.
    // If 0 rows are affected, throw so withIdempotency releases the claim
    // and a retry can re-attempt once the session reaches the correct state.
    const updated = await db
      .update(sessions)
      .set({
        status: "paid",
        maxRegens: PACK_REGEN_LIMIT,
        regenCount: 0,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.status, "direction_selected")
        )
      )
      .returning({ id: sessions.id });

    if (updated.length === 0) {
      throw new Error(
        `Cannot transition session "${sessionId}" to paid: not in direction_selected state`
      );
    }

    // Promote user to premium on first payment (idempotent — no-ops if already premium)
    await promoteUserToPremium(userId);
  });
}

export async function getPaymentBySessionId(sessionId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.sessionId, sessionId));

  return payment ?? null;
}

export async function checkPackBoundary(sessionId: string, userId: string) {
  const [session] = await db
    .select({
      status: sessions.status,
      userId: sessions.userId,
      regenCount: sessions.regenCount,
      maxRegens: sessions.maxRegens,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.userId !== userId) {
    throw new Error("Session not found");
  }

  // Premium users always have full access
  const premium = await isPremiumUser(userId);
  if (premium) {
    return {
      isPaid: true,
      canRegenerate: true,
      regenCount: session.regenCount,
      maxRegens: session.maxRegens,
    };
  }

  const paidStatuses = ["paid", "generating_images", "evaluating", "selecting", "packaging", "delivered"];
  const isPaid = paidStatuses.includes(session.status);
  const canRegenerate = isPaid && session.regenCount < session.maxRegens;

  return {
    isPaid,
    canRegenerate,
    regenCount: session.regenCount,
    maxRegens: session.maxRegens,
  };
}

export async function incrementRegenCount(sessionId: string) {
  // Pre-condition: only allow regen count increment when session is in a
  // paid-forward state. The regenerate flow is triggered from `selecting`
  // (user requests another batch), then proceeds through `generating_images`.
  const result = await db
    .update(sessions)
    .set({
      regenCount: sql`${sessions.regenCount} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(sessions.id, sessionId),
        sql`${sessions.status} IN ('paid', 'generating_images', 'selecting')`
      )
    )
    .returning({ id: sessions.id });

  if (result.length === 0) {
    throw new Error(
      `Cannot increment regen count: session "${sessionId}" is not in a valid state`
    );
  }
}
