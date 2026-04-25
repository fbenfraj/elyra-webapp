import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  getUserSettings,
  setSpotifyArtist,
  clearSpotifyArtist,
} from "@/server/services/user";
import { searchArtists } from "@/server/providers/spotify";

export const userRouter = createTRPCRouter({
  settings: authedProcedure.query(async ({ ctx }) => {
    const settings = await getUserSettings(ctx.user.id);
    return settings ?? {
      spotifyArtistId: null,
      spotifyArtistName: null,
      spotifyArtistImageUrl: null,
    };
  }),

  searchArtists: authedProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      try {
        return await searchArtists(input.query, 5);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Spotify search is temporarily unavailable",
        });
      }
    }),

  setSpotifyArtist: authedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        imageUrl: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setSpotifyArtist(ctx.user.id, input);
      return { ok: true };
    }),

  clearSpotifyArtist: authedProcedure.mutation(async ({ ctx }) => {
    await clearSpotifyArtist(ctx.user.id);
    return { ok: true };
  }),
});
