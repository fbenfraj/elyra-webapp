import "server-only";

import { db } from "@/server/db";
import { userReferences } from "@/server/db/schema/user-references";
import { eq, and, desc } from "drizzle-orm";
import { getSignedImageUrl, deleteR2Object } from "@/server/services/storage";

const MAX_REFERENCES_PER_USER = 50;

export type UserReference = {
  id: string;
  source: string;
  imageUrl: string;
  originalFilename: string | null;
  width: number;
  height: number;
  fileSizeBytes: number;
  spotifyArtistId: string | null;
  createdAt: Date;
};

export async function listUserReferences(
  userId: string
): Promise<UserReference[]> {
  const rows = await db
    .select()
    .from(userReferences)
    .where(eq(userReferences.userId, userId))
    .orderBy(desc(userReferences.createdAt));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      source: row.source,
      imageUrl: await getSignedImageUrl(row.r2Key),
      originalFilename: row.originalFilename,
      width: row.width,
      height: row.height,
      fileSizeBytes: row.fileSizeBytes,
      spotifyArtistId: row.spotifyArtistId,
      createdAt: row.createdAt,
    }))
  );
}

export async function getUserReferenceCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: userReferences.id })
    .from(userReferences)
    .where(eq(userReferences.userId, userId));
  return rows.length;
}

export async function canUpload(userId: string, count: number): Promise<boolean> {
  const existing = await getUserReferenceCount(userId);
  return existing + count <= MAX_REFERENCES_PER_USER;
}

export async function createUserReference(
  userId: string,
  data: {
    source: "upload" | "spotify_profile" | "spotify_cover";
    r2Key: string;
    originalFilename: string | null;
    width: number;
    height: number;
    fileSizeBytes: number;
    spotifyArtistId?: string | null;
  }
): Promise<{ id: string }> {
  const [row] = await db
    .insert(userReferences)
    .values({
      userId,
      source: data.source,
      r2Key: data.r2Key,
      originalFilename: data.originalFilename,
      width: data.width,
      height: data.height,
      fileSizeBytes: data.fileSizeBytes,
      spotifyArtistId: data.spotifyArtistId ?? null,
    })
    .returning({ id: userReferences.id });

  return row;
}

export async function deleteUserReference(
  userId: string,
  referenceId: string
): Promise<void> {
  const [row] = await db
    .select({ id: userReferences.id, r2Key: userReferences.r2Key, source: userReferences.source })
    .from(userReferences)
    .where(
      and(eq(userReferences.id, referenceId), eq(userReferences.userId, userId))
    );

  if (!row) {
    throw new Error("Reference not found");
  }

  // Only delete R2 object for uploads — Spotify images live in artist_albums
  if (row.source === "upload") {
    await deleteR2Object(row.r2Key);
  }

  await db
    .delete(userReferences)
    .where(eq(userReferences.id, referenceId));
}

export async function validateOwnership(
  userId: string,
  referenceIds: string[]
): Promise<boolean> {
  if (referenceIds.length === 0) return true;

  const rows = await db
    .select({ id: userReferences.id })
    .from(userReferences)
    .where(eq(userReferences.userId, userId));

  const ownedIds = new Set(rows.map((r) => r.id));
  return referenceIds.every((id) => ownedIds.has(id));
}

export async function getReferenceR2Keys(
  referenceIds: string[]
): Promise<Array<{ id: string; r2Key: string }>> {
  if (referenceIds.length === 0) return [];

  const rows = await db
    .select({ id: userReferences.id, r2Key: userReferences.r2Key })
    .from(userReferences);

  const idSet = new Set(referenceIds);
  return rows.filter((r) => idSet.has(r.id));
}

/**
 * Upsert user_references rows for Spotify-sourced images.
 * Deduplicates by r2Key to avoid duplicates on re-sync.
 */
export async function upsertSpotifyReferences(
  userId: string,
  artistId: string,
  images: Array<{
    source: "spotify_profile" | "spotify_cover";
    r2Key: string;
    originalFilename: string | null;
    width: number;
    height: number;
  }>
): Promise<number> {
  let inserted = 0;

  for (const img of images) {
    // Check if already exists by r2Key
    const [existing] = await db
      .select({ id: userReferences.id })
      .from(userReferences)
      .where(
        and(
          eq(userReferences.userId, userId),
          eq(userReferences.r2Key, img.r2Key)
        )
      );

    if (existing) continue;

    await db.insert(userReferences).values({
      userId,
      source: img.source,
      r2Key: img.r2Key,
      originalFilename: img.originalFilename,
      width: img.width,
      height: img.height,
      fileSizeBytes: 0,
      spotifyArtistId: artistId,
    });

    inserted++;
  }

  return inserted;
}
