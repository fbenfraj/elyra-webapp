import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import {
  getCurrentPalette,
  startOrResumePalette,
  setMoodAnchor,
  setDominant,
  setAccent,
  setNeutrals,
  lockPalette,
  unlockForEdit,
  jumpToStep,
} from "@/server/services/palette";
import {
  suggestMoodAnchors,
  suggestDominant,
  suggestAccent,
  suggestNeutrals,
} from "@/server/services/palette-suggestions";
import {
  moodAnchorSchema,
  paletteStepSchema,
  setHexInputSchema,
  setMoodAnchorInputSchema,
  setNeutralsInputSchema,
} from "@/lib/schemas/palette";

export const paletteRouter = createTRPCRouter({
  current: authedProcedure.query(async ({ ctx }) => {
    return getCurrentPalette(ctx.user.id);
  }),

  startOrResume: authedProcedure.mutation(async ({ ctx }) => {
    return startOrResumePalette(ctx.user.id);
  }),

  jumpToStep: authedProcedure
    .input(z.object({ step: paletteStepSchema }))
    .mutation(async ({ ctx, input }) => {
      return jumpToStep(ctx.user.id, input.step);
    }),

  suggestMoodAnchors: authedProcedure.mutation(async ({ ctx }) => {
    return suggestMoodAnchors(ctx.user.id);
  }),

  setMoodAnchor: authedProcedure
    .input(setMoodAnchorInputSchema)
    .mutation(async ({ ctx, input }) => {
      return setMoodAnchor(ctx.user.id, input.anchor);
    }),

  suggestDominant: authedProcedure
    .input(z.object({ anchor: moodAnchorSchema }))
    .mutation(async ({ ctx, input }) => {
      return suggestDominant(ctx.user.id, input.anchor);
    }),

  setDominant: authedProcedure
    .input(setHexInputSchema)
    .mutation(async ({ ctx, input }) => {
      return setDominant(ctx.user.id, input.hex);
    }),

  suggestAccent: authedProcedure.mutation(async ({ ctx }) => {
    const current = await getCurrentPalette(ctx.user.id);
    if (!current?.moodAnchor || !current.dominant) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Set mood anchor and dominant before suggesting accents",
      });
    }
    return suggestAccent(ctx.user.id, current.moodAnchor, current.dominant);
  }),

  setAccent: authedProcedure
    .input(setHexInputSchema)
    .mutation(async ({ ctx, input }) => {
      return setAccent(ctx.user.id, input.hex);
    }),

  suggestNeutrals: authedProcedure.mutation(async ({ ctx }) => {
    const current = await getCurrentPalette(ctx.user.id);
    if (!current?.moodAnchor || !current.dominant || !current.accent) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Set mood anchor, dominant, and accent before suggesting neutrals",
      });
    }
    return suggestNeutrals(
      ctx.user.id,
      current.moodAnchor,
      current.dominant,
      current.accent
    );
  }),

  setNeutrals: authedProcedure
    .input(setNeutralsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [a, b, c] = input.hexes;
      return setNeutrals(ctx.user.id, [a, b, c]);
    }),

  lock: authedProcedure.mutation(async ({ ctx }) => {
    return lockPalette(ctx.user.id);
  }),

  editLocked: authedProcedure.mutation(async ({ ctx }) => {
    return unlockForEdit(ctx.user.id);
  }),
});
