import "server-only";

import Stripe from "stripe";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema/payments";
import { sessions } from "@/server/db/schema/sessions";
import { eq, sql } from "drizzle-orm";
import { PACK_PRICE_CENTS, PACK_CURRENCY, PACK_REGEN_LIMIT } from "@/config/pricing";

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
    success_url: `${baseUrl}/generate?session_id=${sessionId}&payment=success`,
    cancel_url: `${baseUrl}/generate?session_id=${sessionId}&payment=cancelled`,
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

  // Idempotent: check if payment already exists for this Stripe session
  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.stripeSessionId, checkoutSession.id));

  if (!existing) {
    // Insert payment record
    await db.insert(payments).values({
      sessionId,
      userId,
      stripeSessionId: checkoutSession.id,
      amountCents: checkoutSession.amount_total ?? PACK_PRICE_CENTS,
      currency: checkoutSession.currency ?? PACK_CURRENCY,
      status: "completed",
    });
  }

  // Always attempt session update — handles partial failure recovery
  // where payment row was inserted but session update failed on a prior attempt
  const [session] = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (session && session.status !== "paid") {
    await db
      .update(sessions)
      .set({
        status: "paid",
        maxRegens: PACK_REGEN_LIMIT,
        regenCount: 0,
        updatedAt: sql`now()`,
      })
      .where(eq(sessions.id, sessionId));
  }
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

  const isPaid = session.status === "paid";
  const canRegenerate = isPaid && session.regenCount < session.maxRegens;

  return {
    isPaid,
    canRegenerate,
    regenCount: session.regenCount,
    maxRegens: session.maxRegens,
  };
}

export async function incrementRegenCount(sessionId: string) {
  await db
    .update(sessions)
    .set({
      regenCount: sql`${sessions.regenCount} + 1`,
      updatedAt: sql`now()`,
    })
    .where(eq(sessions.id, sessionId));
}
