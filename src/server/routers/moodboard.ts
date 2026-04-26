import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { tasks } from "@trigger.dev/sdk/v3";
import {
  createMoodboard,
  getActiveMoodboard,
  getMoodboardById,
  likeDirection,
  unlikeDirection,
  transitionToRefining,
  revertToExploring,
  completeMoodboard,
} from "@/server/services/moodboard";
import { computeRefinementDefaults, applyPaletteNudge } from "@/server/services/moodboard-refinement";
import { moodboardSpecSchema, paletteNudgeSchema } from "@/lib/schemas/moodboard";
import { getSignedImageUrl } from "@/server/services/storage";
import type { moodboardGenerateDirections } from "@/trigger/moodboard-generate-directions";

export const moodboardRouter = createTRPCRouter({
  active: authedProcedure.query(async ({ ctx }) => {
    return getActiveMoodboard(ctx.user.id);
  }),

  getById: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const moodboard = await getMoodboardById(input.id, ctx.user.id);
      if (!moodboard) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Moodboard not found." });
      }

      const directionsWithUrls = moodboard.explorationDirections
        ? await Promise.all(
            moodboard.explorationDirections.map(async (dir) => ({
              ...dir,
              heroImageUrl: await getSignedImageUrl(dir.imageKey),
            }))
          )
        : [];

      return { ...moodboard, directionsWithUrls };
    }),

  create: authedProcedure.mutation(async ({ ctx }) => {
    const { id: moodboardId } = await createMoodboard(ctx.user.id);

    await tasks.trigger<typeof moodboardGenerateDirections>(
      "moodboard-generate-directions",
      {
        sessionId: moodboardId,
        userId: ctx.user.id,
        input: { moodboardId },
      }
    );

    return { moodboardId };
  }),

  likeDirection: authedProcedure
    .input(z.object({ moodboardId: z.string(), directionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moodboard = await getMoodboardById(input.moodboardId, ctx.user.id);
      if (!moodboard) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Moodboard not found." });
      }
      if (moodboard.status !== "exploring") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Moodboard is not in exploring state." });
      }

      const updated = await likeDirection(input.moodboardId, input.directionId, moodboard.likedDirectionIds);
      return { likedDirectionIds: updated };
    }),

  unlikeDirection: authedProcedure
    .input(z.object({ moodboardId: z.string(), directionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moodboard = await getMoodboardById(input.moodboardId, ctx.user.id);
      if (!moodboard) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Moodboard not found." });
      }
      if (moodboard.status !== "exploring") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Moodboard is not in exploring state." });
      }

      const updated = await unlikeDirection(input.moodboardId, input.directionId, moodboard.likedDirectionIds);
      return { likedDirectionIds: updated };
    }),

  startRefinement: authedProcedure
    .input(z.object({ moodboardId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const moodboard = await getMoodboardById(input.moodboardId, ctx.user.id);
      if (!moodboard) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Moodboard not found." });
      }
      if (moodboard.status !== "exploring") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Moodboard is not in exploring state." });
      }
      if (moodboard.likedDirectionIds.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Like at least one direction before continuing." });
      }

      await transitionToRefining(input.moodboardId);

      // If LLM fails, revert to exploring so user can retry
      try {
        const { spec } = await computeRefinementDefaults(moodboard, ctx.user.id);
        return spec;
      } catch (error) {
        await revertToExploring(input.moodboardId);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to compute refinement defaults. Please try again.",
        });
      }
    }),

  complete: authedProcedure
    .input(
      z.object({
        moodboardId: z.string(),
        spec: moodboardSpecSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const moodboard = await getMoodboardById(input.moodboardId, ctx.user.id);
      if (!moodboard) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Moodboard not found." });
      }
      if (moodboard.status !== "refining") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Moodboard is not in refining state." });
      }

      await completeMoodboard(
        input.moodboardId,
        input.spec,
        moodboard.likedDirectionIds,
        moodboard.explorationDirections ?? []
      );

      return { success: true };
    }),

  nudgePalette: authedProcedure
    .input(
      z.object({
        palette: z.array(z.string()).length(5),
        nudge: paletteNudgeSchema,
      })
    )
    .query(({ input }) => {
      return { palette: applyPaletteNudge(input.palette, input.nudge) };
    }),
});
