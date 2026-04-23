import "server-only";

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { createCheckoutSession, checkPackBoundary } from "@/server/services/payment";

export const paymentRouter = createTRPCRouter({
  createCheckout: authedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCheckoutSession(input.sessionId, ctx.user.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Payment failed";
        throw new TRPCError({
          code: message === "Session not found" ? "NOT_FOUND" : "BAD_REQUEST",
          message,
        });
      }
    }),

  getPackStatus: authedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await checkPackBoundary(input.sessionId, ctx.user.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pack status check failed";
        throw new TRPCError({
          code: message === "Session not found" ? "NOT_FOUND" : "BAD_REQUEST",
          message,
        });
      }
    }),
});
