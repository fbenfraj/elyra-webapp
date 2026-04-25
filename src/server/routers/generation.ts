import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { runInterpretation } from "@/server/services/interpretation";
import { getDirectionsForSession } from "@/server/services/direction-generation";
import { selectDirection, getSessionById, clearFailedStage, updateSessionStatus } from "@/server/services/session";
import type { SessionStatus } from "@/server/services/session";
import { refineSession, commitRefinement } from "@/server/services/refine-session";
import { checkPackBoundary, incrementRegenCount } from "@/server/services/payment";
import { checkUserBudget } from "@/server/services/budget";
import { getCuratedImages } from "@/server/services/evaluation";
import { selectImage, confirmSelection } from "@/server/services/image-generation";
import { generationCreateDirections } from "@/trigger/generation-create-directions";
import { generationCreateImages } from "@/trigger/generation-create-images";
import { generationEvaluateBatch } from "@/trigger/generation-evaluate-batch";
import { generationAssemblePackage } from "@/trigger/generation-assemble-package";
import { generationInterpretBrief } from "@/trigger/generation-interpret-brief";
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
          failedStage: sessions.failedStage,
          briefText: sessions.briefText,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.user.id)
          )
        );

      if (!session) {
        return { status: "not_found", stepLabel: "Session not found", failedStage: null, canRetry: false, briefText: null };
      }

      const stepLabelMap: Record<string, string> = {
        pending: "Starting...",
        interpreting: "Interpreting your vision...",
        generating_directions: "Exploring visual directions...",
        complete: "Ready",
        direction_selected: "Direction chosen",
        paid: "Preparing your release pack...",
        generating_images: "Generating within your direction...",
        evaluating: "Evaluating composition and mood...",
        selecting: "Curating the strongest results...",
        packaging: "Assembling your release package...",
        delivered: "Your pack is ready",
        failed: "Something went wrong",
      };

      // Content policy failures are not retryable
      const isContentPolicy = session.failedStage === "content_policy";
      const canRetry = session.status === "failed" && !isContentPolicy;

      return {
        status: session.status,
        stepLabel: stepLabelMap[session.status] ?? "Processing...",
        failedStage: session.failedStage,
        canRetry,
        briefText: session.briefText,
      };
    }),

  getFullSession: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Fetch full session row
      const [session] = await db
        .select({
          id: sessions.id,
          status: sessions.status,
          briefText: sessions.briefText,
          failedStage: sessions.failedStage,
          selectedDirectionId: sessions.selectedDirectionId,
          selectedGenerationJobId: sessions.selectedGenerationJobId,
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

      const status = session.status as SessionStatus;

      // For statuses where directions exist, fetch them
      const directionsStatuses: string[] = [
        "selecting", "complete", "direction_selected",
        "paid", "generating_images", "evaluating",
      ];
      let directions: Awaited<ReturnType<typeof getDirectionsForSession>> = null;
      if (directionsStatuses.includes(status)) {
        directions = await getDirectionsForSession(input.sessionId);
      }

      // TODO: Add deliverables fetch when delivery service is available
      const deliverables: Array<{ id: string; format: string; fileUrl: string }> = [];

      // Content policy failures are not retryable
      const isContentPolicy = session.failedStage === "content_policy";
      const canRetry = status === "failed" && !isContentPolicy;

      return {
        status,
        briefText: session.briefText,
        failedStage: session.failedStage,
        canRetry,
        selectedDirectionId: session.selectedDirectionId,
        directions: directions?.directions ?? null,
        generationJobId: directions?.generationJobId ?? null,
        deliverables,
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
        directionId: z.string(),
        generationJobId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await selectDirection(
        input.sessionId,
        ctx.user.id,
        input.directionId,
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

  startImageGeneration: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select({
          id: sessions.id,
          status: sessions.status,
          regenCount: sessions.regenCount,
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

      if (session.status !== "paid") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not paid or ready for image generation",
        });
      }

      // Check user daily budget
      const userBudget = await checkUserBudget(ctx.user.id);
      if (!userBudget.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You've reached your daily limit. Come back tomorrow!",
        });
      }

      // Check pack boundary
      const boundary = await checkPackBoundary(input.sessionId, ctx.user.id);
      if (!boundary.isPaid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not paid",
        });
      }

      const batchNumber = session.regenCount + 1;

      // Move status before enqueueing to prevent double-submit races
      await updateSessionStatus(session.id, "generating_images");

      await generationCreateImages.trigger({
        sessionId: session.id,
        userId: ctx.user.id,
        input: { batchNumber },
      });

      return { queued: true, batchNumber };
    }),

  getImageGenerationStatus: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db
        .select({
          status: sessions.status,
          failedStage: sessions.failedStage,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.user.id)
          )
        );

      if (!session) {
        return { status: "not_found", stepLabel: "Session not found", failedStage: null, canRetry: false };
      }

      const stepLabelMap: Record<string, string> = {
        paid: "Preparing your release pack...",
        generating_images: "Generating within your direction...",
        evaluating: "Evaluating composition and mood...",
        selecting: "Curating the strongest results...",
        packaging: "Assembling your release package...",
        delivered: "Your pack is ready",
        failed: "Something went wrong",
      };

      const isContentPolicy = session.failedStage === "content_policy";
      const canRetry = session.status === "failed" && !isContentPolicy;

      return {
        status: session.status,
        stepLabel: stepLabelMap[session.status] ?? "Processing...",
        failedStage: session.failedStage,
        canRetry,
      };
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

  getCuratedImages: authedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
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

      // Returns images WITHOUT scores — scores are never exposed to the client
      const { images } = await getCuratedImages(input.sessionId);

      return {
        images: images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          batchNumber: img.batchNumber,
        })),
      };
    }),

  selectImage: authedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        attemptId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await selectImage(
        input.sessionId,
        ctx.user.id,
        input.attemptId
      );

      if (!result.ok) {
        throw new TRPCError({
          code: result.error.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
          message: result.error.message,
        });
      }

      return { ok: true };
    }),

  regenerate: authedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select({
          id: sessions.id,
          status: sessions.status,
          regenCount: sessions.regenCount,
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

      if (session.status !== "selecting") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not in selecting phase",
        });
      }

      // Check user daily budget
      const regenBudget = await checkUserBudget(ctx.user.id);
      if (!regenBudget.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You've reached your daily limit. Come back tomorrow!",
        });
      }

      // Check pack boundary
      const boundary = await checkPackBoundary(input.sessionId, ctx.user.id);
      if (!boundary.canRegenerate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Regeneration limit reached",
        });
      }

      // Increment regen count and move status before enqueueing to prevent double-submit races
      await incrementRegenCount(input.sessionId);
      await updateSessionStatus(input.sessionId, "generating_images");

      const batchNumber = session.regenCount + 2; // +1 for initial batch, +1 for new regen

      // Trigger generation-create-images task
      await generationCreateImages.trigger({
        sessionId: session.id,
        userId: ctx.user.id,
        input: { batchNumber },
      });

      return { queued: true, batchNumber };
    }),

  confirmSelection: authedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await confirmSelection(
        input.sessionId,
        ctx.user.id
      );

      if (!result.ok) {
        throw new TRPCError({
          code: result.error.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
          message: result.error.message,
        });
      }

      // Fire-and-observe: trigger package assembly task
      await generationAssemblePackage.trigger({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        input: {},
      });

      return { ok: true };
    }),

  retry: authedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      if (session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      if (session.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not in a failed state",
        });
      }

      if (!session.failedStage) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No failed stage recorded",
        });
      }

      // Content policy failures are not retryable
      if (session.failedStage === "content_policy") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This failure cannot be retried. Try adjusting your brief.",
        });
      }

      // Map failedStage to the in-progress status to restore
      const stageToStatusMap: Record<string, SessionStatus> = {
        interpreting: "interpreting",
        generating_directions: "generating_directions",
        generating_images: "generating_images",
        evaluating: "evaluating",
        packaging: "packaging",
      };

      const restoreStatus = stageToStatusMap[session.failedStage];
      if (!restoreStatus) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown failed stage",
        });
      }

      // Reset status and clear failedStage
      await updateSessionStatus(input.sessionId, restoreStatus);
      await clearFailedStage(input.sessionId);

      // Re-trigger the appropriate task
      const payload = { sessionId: input.sessionId, userId: ctx.user.id };

      switch (session.failedStage) {
        case "interpreting": {
          await generationInterpretBrief.trigger({
            ...payload,
            input: { briefText: session.briefText },
          });
          break;
        }
        case "generating_directions": {
          // Look up the visual spec for this session
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

          await generationCreateDirections.trigger({
            ...payload,
            input: { visualSpecId: spec.id },
          });
          break;
        }
        case "generating_images": {
          const batchNumber = session.regenCount + 1;
          await generationCreateImages.trigger({
            ...payload,
            input: { batchNumber },
          });
          break;
        }
        case "evaluating": {
          await generationEvaluateBatch.trigger({
            ...payload,
            input: {},
          });
          break;
        }
        case "packaging": {
          await generationAssemblePackage.trigger({
            ...payload,
            input: {},
          });
          break;
        }
      }

      return { ok: true, retriedStage: session.failedStage };
    }),

  editBrief: authedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        newBriefText: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { editBrief } = await import("@/server/services/session");
      const result = await editBrief(
        input.sessionId,
        ctx.user.id,
        input.newBriefText
      );

      if (!result.ok) {
        throw new TRPCError({
          code: result.error.code === "NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
          message: result.error.message,
        });
      }

      // Trigger re-interpretation with the new brief
      return runInterpretation(input.sessionId, ctx.user.id, input.newBriefText);
    }),

  changeDirectionPostPayment: authedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        directionId: z.string(),
        generationJobId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { changeDirectionPostPayment } = await import(
        "@/server/services/session"
      );
      const result = await changeDirectionPostPayment(
        input.sessionId,
        ctx.user.id,
        input.directionId,
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
});
