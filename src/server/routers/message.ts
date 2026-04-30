import "server-only";

import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import {
  generateQuestions,
  submitAnswers,
  getActiveMessage,
  regenerateSection,
} from "@/server/services/message";
import {
  messageInputsSchema,
  messageSectionKeySchema,
} from "@/lib/schemas/message";
import { z } from "zod/v4";

export const messageRouter = createTRPCRouter({
  active: authedProcedure.query(async ({ ctx }) => {
    return getActiveMessage(ctx.user.id);
  }),

  generateQuestions: authedProcedure.mutation(async ({ ctx }) => {
    return generateQuestions(ctx.user.id);
  }),

  submitAnswers: authedProcedure
    .input(z.object({ inputs: messageInputsSchema }))
    .mutation(async ({ ctx, input }) => {
      return submitAnswers(ctx.user.id, input.inputs);
    }),

  regenerateSection: authedProcedure
    .input(
      z.object({
        sectionKey: messageSectionKeySchema,
        feedback: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return regenerateSection(ctx.user.id, input.sectionKey, input.feedback);
    }),
});
