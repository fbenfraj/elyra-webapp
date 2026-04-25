import "server-only";

import { db } from "@/server/db";
import { users } from "@/server/db/schema/users";
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

export async function getUserSettings(userId: string) {
  const [user] = await db
    .select({
      spotifyArtistId: users.spotifyArtistId,
      spotifyArtistName: users.spotifyArtistName,
      spotifyArtistImageUrl: users.spotifyArtistImageUrl,
    })
    .from(users)
    .where(eq(users.id, userId));

  return user ?? null;
}

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
