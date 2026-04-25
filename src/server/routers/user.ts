import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  getUserSettings,
  setUserArtist,
  clearUserArtist,
  completeOnboarding,
  getOnboardingStatus,
} from "@/server/services/user";
import { searchArtists } from "@/server/providers/spotify";
import { syncArtist } from "@/server/services/spotify-sync";

export const userRouter = createTRPCRouter({
  settings: authedProcedure.query(async ({ ctx }) => {
    return getUserSettings(ctx.user.id);
  }),

  onboardingStatus: authedProcedure.query(async ({ ctx }) => {
    const completed = await getOnboardingStatus(ctx.user.id);
    return { completed };
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

  syncArtist: authedProcedure
    .input(z.object({ spotifyId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const artist = await syncArtist(input.spotifyId);
        return {
          id: artist.id,
          name: artist.name,
          profileImageUrl: artist.profileImageUrl,
          genres: artist.genres,
          popularity: artist.popularity,
          followerCount: artist.followerCount,
          albums: artist.albums.map((a) => ({
            id: a.id,
            name: a.name,
            releaseDate: a.releaseDate,
            albumType: a.albumType,
            coverImageUrl: a.coverImageUrl,
          })),
        };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync artist data from Spotify",
        });
      }
    }),

  selectArtist: authedProcedure
    .input(z.object({ artistId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await setUserArtist(ctx.user.id, input.artistId);
      return { ok: true };
    }),

  clearArtist: authedProcedure.mutation(async ({ ctx }) => {
    await clearUserArtist(ctx.user.id);
    return { ok: true };
  }),

  completeOnboarding: authedProcedure
    .input(
      z.object({ artistId: z.string().min(1).optional() })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.artistId) {
        await setUserArtist(ctx.user.id, input.artistId);
      }
      await completeOnboarding(ctx.user.id);
      return { ok: true };
    }),
});
