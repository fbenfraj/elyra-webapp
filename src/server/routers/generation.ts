import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { runInterpretation } from "@/server/services/interpretation";
import { getDirectionsForSession } from "@/server/services/direction-generation";
import { selectDirection } from "@/server/services/session";
import { refineSession, commitRefinement } from "@/server/services/refine-session";
import { generationCreateDirections } from "@/trigger/generation-create-directions";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { visualSpecs } from "@/server/db/schema/visual-specs";
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
        direction_selected: "Direction chosen",
        paid: "Preparing your release pack...",
        failed: "Something went wrong",
      };

      return {
        status: session.status,
        stepLabel: stepLabelMap[session.status] ?? "Processing...",
      };
    }),

  startDirections: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify session belongs to user and is in generating_directions state
      const [session] = await db
        .select({ id: sessions.id, status: sessions.status })
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

      if (session.status !== "generating_directions") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not ready for direction generation",
        });
      }

      // Find the visual spec for this session
      const [spec] = await db
        .select({ id: visualSpecs.id })
        .from(visualSpecs)
        .where(eq(visualSpecs.sessionId, input.sessionId));

      if (!spec) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Visual specification not found for this session",
        });
      }

      // Queue the task via Trigger.dev — returns immediately, UI polls getStatus
      await generationCreateDirections.trigger({
        sessionId: session.id,
        userId: ctx.user.id,
        input: { visualSpecId: spec.id },
      });

      return { queued: true };
    }),

  selectDirection: authedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        directionIndex: z.number().int().min(0).max(2),
        generationJobId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await selectDirection(
        input.sessionId,
        ctx.user.id,
        input.directionIndex,
        input.generationJobId
      );

      if (!result.ok) {
        throw new TRPCError({
          code: result.error.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
          message: result.error.message,
        });
      }

      return { ok: true };
    }),

  refine: authedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        selectedPills: z.array(z.string()).optional().default([]),
        refinementText: z.string().optional().default(""),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await refineSession(
        input.sessionId,
        ctx.user.id,
        input.selectedPills,
        input.refinementText
      );

      if (!result.ok) {
        throw new TRPCError({
          code: result.error.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
          message: result.error.message,
        });
      }

      // Commit the refinement to the session BEFORE running interpretation.
      // This resets status to "pending" so the pipeline can proceed.
      // If interpretation fails, the session stays at "pending" (not "complete"),
      // but the original brief text is preserved in refinementHistory.
      await commitRefinement(
        input.sessionId,
        result.refinedBrief,
        result.sessionSnapshot.refinementCount,
        result.sessionSnapshot.refinementHistory
      );

      // Run interpretation on the refined brief.
      return runInterpretation(input.sessionId, ctx.user.id, result.refinedBrief);
    }),

  getAllDirections: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify session belongs to user
      const [session] = await db
        .select({ id: sessions.id })
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

      const { getAllDirectionRoundsForSession } = await import(
        "@/server/services/direction-generation"
      );
      const rounds = await getAllDirectionRoundsForSession(input.sessionId);
      return { rounds };
    }),

  getDirections: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify session belongs to user
      const [session] = await db
        .select({ id: sessions.id })
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

      const result = await getDirectionsForSession(input.sessionId);
      return {
        directions: result?.directions ?? null,
        generationJobId: result?.generationJobId ?? null,
      };
    }),
});
