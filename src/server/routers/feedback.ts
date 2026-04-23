import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { toggleLike, getLikedAttemptIds } from "@/server/services/feedback";
import { captureEvent } from "@/server/services/event-capture";

export const feedbackRouter = createTRPCRouter({
  like: authedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        generationAttemptId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return toggleLike(
        ctx.user.id,
        input.sessionId,
        input.generationAttemptId
      );
    }),

  getLikes: authedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getLikedAttemptIds(ctx.user.id, input.sessionId);
    }),

  captureEvent: authedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        action: z.enum([
          "direction_selected",
          "direction_rejected",
          "image_selected",
          "image_deselected",
          "regeneration_requested",
          "brief_refined",
          "screen_entered",
          "screen_exited",
          "recovery_started",
          "suggestion_pill_selected",
        ]),
        payload: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      void captureEvent(
        ctx.user.id,
        input.sessionId,
        input.action,
        input.payload
      );
      return { ok: true };
    }),
});
