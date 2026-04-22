import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { runInterpretation } from "@/server/services/interpretation";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const generationRouter = createTRPCRouter({
  start: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify session belongs to user and fetch brief text
      const [session] = await db
        .select({
          id: sessions.id,
          briefText: sessions.briefText,
          status: sessions.status,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.user.id)
          )
        );

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      if (session.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session has already been processed",
        });
      }

      return runInterpretation(session.id, ctx.user.id, session.briefText);
    }),

  getStatus: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db
        .select({
          status: sessions.status,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.user.id)
          )
        );

      if (!session) {
        return { status: "not_found", stepLabel: "Session not found" };
      }

      const stepLabelMap: Record<string, string> = {
        pending: "Starting...",
        interpreting: "Interpreting your vision...",
        generating_directions: "Exploring visual directions...",
        evaluating: "Evaluating and curating...",
        packaging: "Assembling your release package...",
        complete: "Ready",
        failed: "Something went wrong",
      };

      return {
        status: session.status,
        stepLabel: stepLabelMap[session.status] ?? "Processing...",
      };
    }),
});
