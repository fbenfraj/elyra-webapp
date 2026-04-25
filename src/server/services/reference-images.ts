// apps/web/src/server/services/reference-images.ts
import "server-only";

import { db } from "@/server/db";
import { referenceImages } from "@/server/db/schema/reference-images";
import { eq, asc } from "drizzle-orm";
import {
  parseSpotifyArtistId,
  fetchArtistProfile,
  fetchArtistCovers,
} from "@/server/providers/spotify";
import { uploadImageFromUrl, getSignedImageUrl } from "@/server/services/storage";
import { REFERENCE_IMAGE_MIN_SIZE } from "@/config/providers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReferenceImageRow = {
  id: string;
  sessionId: string;
  type: string;
  source: string;
  sourceUrl: string;
  r2Key: string;
  width: number;
  height: number;
  position: number;
};

type FetchedImage = {
  type: "profile" | "cover";
  sourceUrl: string;
  width: number;
  height: number;
};

export type ReferenceFallbackReason =
  | "no_spotify_url"
  | "spotify_fetch_failed"
  | "no_valid_images"
  | "kontext_failed"
  | "low_quality_reference";

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Fetch Spotify images and store them in R2 + reference_images table.
 *
 * Returns the number of images stored, or 0 if fetching failed (non-blocking).
 */
export async function fetchAndStoreReferences(
  sessionId: string,
  spotifyArtistUrl: string
): Promise<{ stored: number; fallbackReason?: ReferenceFallbackReason }> {
  let artistId: string;
  try {
    artistId = parseSpotifyArtistId(spotifyArtistUrl);
  } catch {
    logFallback(sessionId, "spotify_fetch_failed", "Invalid Spotify URL/ID");
    return { stored: 0, fallbackReason: "spotify_fetch_failed" };
  }

  // Fetch from Spotify
  let images: FetchedImage[];
  try {
    images = await fetchSpotifyImages(artistId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logFallback(sessionId, "spotify_fetch_failed", message);
    return { stored: 0, fallbackReason: "spotify_fetch_failed" };
  }

  // Filter by minimum size
  const validImages = images.filter(
    (img) =>
      img.width >= REFERENCE_IMAGE_MIN_SIZE &&
      img.height >= REFERENCE_IMAGE_MIN_SIZE
  );

  if (validImages.length === 0) {
    logFallback(sessionId, "no_valid_images", `${images.length} images fetched but none met minimum size`);
    return { stored: 0, fallbackReason: "no_valid_images" };
  }

  // Download and upload to R2, then insert DB rows
  let position = 0;
  const rows: (typeof referenceImages.$inferInsert)[] = [];

  for (const img of validImages) {
    const suffix = img.type === "profile" ? "profile" : "cover";
    const r2Key = `references/${sessionId}/${suffix}-${position}.jpg`;

    try {
      await uploadImageFromUrl(r2Key, img.sourceUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logFallback(sessionId, "low_quality_reference", `Failed to upload ${suffix}: ${message}`);
      continue; // skip this image, try remaining
    }

    rows.push({
      sessionId,
      type: img.type,
      source: "spotify",
      sourceUrl: img.sourceUrl,
      r2Key,
      width: img.width,
      height: img.height,
      position,
    });

    position++;
  }

  if (rows.length === 0) {
    logFallback(sessionId, "no_valid_images", "All image uploads failed");
    return { stored: 0, fallbackReason: "no_valid_images" };
  }

  await db.insert(referenceImages).values(rows);

  return { stored: rows.length };
}

/**
 * Fetch profile image + album covers from Spotify.
 * Returns images in deterministic position order:
 *   0 = profile, 1 = primary cover, 2 = secondary cover, 3 = third cover
 */
async function fetchSpotifyImages(artistId: string): Promise<FetchedImage[]> {
  const [profile, covers] = await Promise.all([
    fetchArtistProfile(artistId),
    fetchArtistCovers(artistId, 3),
  ]);

  const images: FetchedImage[] = [];

  if (profile.image) {
    images.push({
      type: "profile",
      sourceUrl: profile.image.url,
      width: profile.image.width,
      height: profile.image.height,
    });
  }

  for (const cover of covers) {
    images.push({
      type: "cover",
      sourceUrl: cover.url,
      width: cover.width,
      height: cover.height,
    });
  }

  return images;
}

/**
 * Get reference images for a session, ordered by position.
 */
export async function getSessionReferences(
  sessionId: string
): Promise<ReferenceImageRow[]> {
  return db
    .select()
    .from(referenceImages)
    .where(eq(referenceImages.sessionId, sessionId))
    .orderBy(asc(referenceImages.position));
}

/**
 * Get signed R2 URLs for a session's reference images, ordered by position.
 */
export async function getSessionReferenceUrls(
  sessionId: string
): Promise<string[]> {
  const refs = await getSessionReferences(sessionId);
  if (refs.length === 0) return [];

  return Promise.all(refs.map((ref) => getSignedImageUrl(ref.r2Key)));
}

/**
 * Delete all reference images for a session (DB rows only — R2 cleanup is optional).
 */
export async function deleteSessionReferences(
  sessionId: string
): Promise<void> {
  await db
    .delete(referenceImages)
    .where(eq(referenceImages.sessionId, sessionId));
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function logFallback(
  sessionId: string,
  reason: ReferenceFallbackReason,
  detail: string
): void {
  console.warn(
    JSON.stringify({
      event: "reference_fallback",
      sessionId,
      reason,
      detail,
    })
  );
}
