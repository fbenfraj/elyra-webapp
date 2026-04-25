import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import {
  listUserImages,
  toggleFavorite,
  deleteImage,
  getImageDownloadUrl,
} from "@/server/services/library";
import { TRPCError } from "@trpc/server";

export const libraryRouter = createTRPCRouter({
  list: authedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        favoritedOnly: z.boolean().optional(),
        since: z.enum(["7d", "30d", "all"]).optional(),
        page: z.number().int().min(1).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return listUserImages(ctx.user.id, input);
    }),

  toggleFavorite: authedProcedure
    .input(z.object({ attemptId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await toggleFavorite(ctx.user.id, input.attemptId);
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Image not found",
        });
      }
    }),

  delete: authedProcedure
    .input(z.object({ attemptId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteImage(ctx.user.id, input.attemptId);
        return { ok: true };
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Image not found",
        });
      }
    }),

  downloadUrl: authedProcedure
    .input(z.object({ attemptId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const url = await getImageDownloadUrl(ctx.user.id, input.attemptId);
        return { url };
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Image not found",
        });
      }
    }),
});
