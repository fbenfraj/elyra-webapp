import "server-only";

import { db } from "@/server/db";
import { users } from "@/server/db/schema/users";
import { spotifyArtists } from "@/server/db/schema/spotify-artists";
import { artistAlbums } from "@/server/db/schema/artist-albums";
import { eq, sql } from "drizzle-orm";

export async function isPremiumUser(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isPremium: users.isPremium })
    .from(users)
    .where(eq(users.id, userId));

  return user?.isPremium ?? false;
}

export async function promoteUserToPremium(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      isPremium: true,
      premiumSince: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
}

export type UserSettings = {
  artistId: string | null;
  artistName: string | null;
  artistImageUrl: string | null;
  artistGenres: string[] | null;
  artistPopularity: number | null;
  artistFollowerCount: number | null;
  artistAlbumCount: number;
  onboardingCompleted: boolean;
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [row] = await db
    .select({
      artistId: users.artistId,
      onboardingCompleted: users.onboardingCompleted,
      artistName: spotifyArtists.name,
      artistImageUrl: spotifyArtists.profileImageUrl,
      artistGenres: spotifyArtists.genres,
      artistPopularity: spotifyArtists.popularity,
      artistFollowerCount: spotifyArtists.followerCount,
    })
    .from(users)
    .leftJoin(spotifyArtists, eq(users.artistId, spotifyArtists.id))
    .where(eq(users.id, userId));

  if (!row) {
    return {
      artistId: null,
      artistName: null,
      artistImageUrl: null,
      artistGenres: null,
      artistPopularity: null,
      artistFollowerCount: null,
      artistAlbumCount: 0,
      onboardingCompleted: false,
    };
  }

  let artistAlbumCount = 0;
  if (row.artistId) {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(artistAlbums)
      .where(eq(artistAlbums.artistId, row.artistId));
    artistAlbumCount = countResult?.count ?? 0;
  }

  return {
    artistId: row.artistId,
    artistName: row.artistName,
    artistImageUrl: row.artistImageUrl,
    artistGenres: row.artistGenres as string[] | null,
    artistPopularity: row.artistPopularity,
    artistFollowerCount: row.artistFollowerCount,
    artistAlbumCount,
    onboardingCompleted: row.onboardingCompleted,
  };
}

export async function setUserArtist(
  userId: string,
  artistId: string
): Promise<void> {
  await db
    .update(users)
    .set({ artistId, updatedAt: sql`now()` })
    .where(eq(users.id, userId));
}

export async function clearUserArtist(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ artistId: null, updatedAt: sql`now()` })
    .where(eq(users.id, userId));
}

export async function completeOnboarding(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardingCompleted: true, updatedAt: sql`now()` })
    .where(eq(users.id, userId));
}

export async function getOnboardingStatus(
  userId: string
): Promise<boolean> {
  const [user] = await db
    .select({ onboardingCompleted: users.onboardingCompleted })
    .from(users)
    .where(eq(users.id, userId));

  return user?.onboardingCompleted ?? false;
}

// Legacy functions — kept for backward compatibility during migration.
// Remove in Phase 2.

export async function setSpotifyArtist(
  userId: string,
  artist: { id: string; name: string; imageUrl: string | null }
): Promise<void> {
  await db
    .update(users)
    .set({
      spotifyArtistId: artist.id,
      spotifyArtistName: artist.name,
      spotifyArtistImageUrl: artist.imageUrl,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
}

export async function clearSpotifyArtist(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      spotifyArtistId: null,
      spotifyArtistName: null,
      spotifyArtistImageUrl: null,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
}
