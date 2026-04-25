// apps/web/src/server/services/spotify-sync.ts
import "server-only";

import { db } from "@/server/db";
import { spotifyArtists } from "@/server/db/schema/spotify-artists";
import { artistAlbums } from "@/server/db/schema/artist-albums";
import { eq, sql } from "drizzle-orm";
import {
  fetchArtistFull,
  fetchArtistTopTracks,
  fetchAudioFeatures,
  fetchArtistAlbums,
} from "@/server/providers/spotify";
import { uploadImageFromUrl } from "@/server/services/storage";
import { upsertSpotifyReferences } from "@/server/services/user-references";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type CachedArtist = {
  id: string;
  spotifyId: string;
  name: string;
  profileImageUrl: string | null;
  profileR2Key: string | null;
  genres: string[] | null;
  popularity: number | null;
  followerCount: number | null;
  audioProfile: {
    energy: number;
    valence: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    tempo: number;
    loudness: number;
  } | null;
  fetchedAt: Date;
  albums: Array<{
    id: string;
    spotifyAlbumId: string;
    name: string;
    releaseDate: string;
    albumType: string;
    coverImageUrl: string | null;
    r2Key: string | null;
  }>;
};

/**
 * Sync an artist from Spotify. Returns cached data if fresh (< 7 days old).
 * Otherwise fetches everything from Spotify, downloads images to R2, and upserts.
 */
export async function syncArtist(spotifyId: string): Promise<CachedArtist> {
  // Check cache
  const [existing] = await db
    .select()
    .from(spotifyArtists)
    .where(eq(spotifyArtists.spotifyId, spotifyId));

  if (existing && Date.now() - existing.fetchedAt.getTime() < TTL_MS) {
    const albums = await db
      .select()
      .from(artistAlbums)
      .where(eq(artistAlbums.artistId, existing.id));

    return {
      ...existing,
      genres: existing.genres as string[] | null,
      audioProfile: existing.audioProfile as CachedArtist["audioProfile"],
      albums,
    };
  }

  // Fetch profile (required — if this fails, let it throw)
  const profile = await fetchArtistFull(spotifyId);

  // Fetch top tracks + audio features (optional — graceful on failure)
  let audioProfile: CachedArtist["audioProfile"] = null;
  try {
    const trackIds = await fetchArtistTopTracks(spotifyId);
    const features = await fetchAudioFeatures(trackIds);
    if (features && features.length > 0) {
      const avg = (key: keyof (typeof features)[0]) => {
        const values = features.map((f) => f[key] as number);
        return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000;
      };
      audioProfile = {
        energy: avg("energy"),
        valence: avg("valence"),
        danceability: avg("danceability"),
        acousticness: avg("acousticness"),
        instrumentalness: avg("instrumentalness"),
        tempo: avg("tempo"),
        loudness: avg("loudness"),
      };
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "sync_audio_features_skipped",
        spotifyId,
        detail: error instanceof Error ? error.message : String(error),
      })
    );
  }

  // Fetch albums (optional — graceful on failure)
  let albumsData: Awaited<ReturnType<typeof fetchArtistAlbums>> = [];
  try {
    albumsData = await fetchArtistAlbums(spotifyId);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "sync_albums_skipped",
        spotifyId,
        detail: error instanceof Error ? error.message : String(error),
      })
    );
  }

  // Download profile image to R2 (optional)
  let profileR2Key: string | null = null;
  if (profile.image) {
    const key = `artists/${spotifyId}/profile.webp`;
    try {
      await uploadImageFromUrl(key, profile.image.url);
      profileR2Key = key;
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "sync_profile_image_skipped",
          spotifyId,
          detail: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // Upsert artist
  const artistRow = {
    spotifyId,
    name: profile.name,
    profileImageUrl: profile.image?.url ?? null,
    profileR2Key,
    genres: profile.genres,
    popularity: profile.popularity,
    followerCount: profile.followerCount,
    audioProfile,
    fetchedAt: new Date(),
  };

  let artistId: string;
  if (existing) {
    await db
      .update(spotifyArtists)
      .set(artistRow)
      .where(eq(spotifyArtists.id, existing.id));
    artistId = existing.id;
  } else {
    const [inserted] = await db
      .insert(spotifyArtists)
      .values(artistRow)
      .returning({ id: spotifyArtists.id });
    artistId = inserted.id;
  }

  // Download album covers to R2 and upsert album rows
  const albumRows: CachedArtist["albums"] = [];

  for (const album of albumsData) {
    let r2Key: string | null = null;
    if (album.coverImageUrl) {
      const key = `artists/${spotifyId}/albums/${album.id}.webp`;
      try {
        await uploadImageFromUrl(key, album.coverImageUrl);
        r2Key = key;
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: "sync_album_cover_skipped",
            spotifyId,
            albumId: album.id,
            detail: error instanceof Error ? error.message : String(error),
          })
        );
      }
    }

    // Upsert album row
    const [row] = await db
      .insert(artistAlbums)
      .values({
        artistId,
        spotifyAlbumId: album.id,
        name: album.name,
        releaseDate: album.releaseDate,
        albumType: album.albumType,
        coverImageUrl: album.coverImageUrl,
        r2Key,
      })
      .onConflictDoUpdate({
        target: [artistAlbums.artistId, artistAlbums.spotifyAlbumId],
        set: {
          name: album.name,
          releaseDate: album.releaseDate,
          albumType: album.albumType,
          coverImageUrl: album.coverImageUrl,
          r2Key: r2Key ?? sql`"artist_albums"."r2_key"`,
        },
      })
      .returning();

    albumRows.push({
      id: row.id,
      spotifyAlbumId: row.spotifyAlbumId,
      name: row.name,
      releaseDate: row.releaseDate,
      albumType: row.albumType,
      coverImageUrl: row.coverImageUrl,
      r2Key: row.r2Key,
    });
  }

  return {
    id: artistId,
    spotifyId,
    name: profile.name,
    profileImageUrl: profile.image?.url ?? null,
    profileR2Key,
    genres: profile.genres,
    popularity: profile.popularity,
    followerCount: profile.followerCount,
    audioProfile,
    fetchedAt: new Date(),
    albums: albumRows,
  };
}

/**
 * Get a cached artist by internal ID (no sync, just read).
 * Returns null if not found.
 */
export async function getCachedArtist(
  artistId: string
): Promise<CachedArtist | null> {
  const [artist] = await db
    .select()
    .from(spotifyArtists)
    .where(eq(spotifyArtists.id, artistId));

  if (!artist) return null;

  const albums = await db
    .select()
    .from(artistAlbums)
    .where(eq(artistAlbums.artistId, artist.id));

  return {
    ...artist,
    genres: artist.genres as string[] | null,
    audioProfile: artist.audioProfile as CachedArtist["audioProfile"],
    albums,
  };
}

/**
 * Sync artist and populate user's reference library with Spotify images.
 * Call this from the user router after artist sync.
 */
export async function syncArtistAndPopulateReferences(
  spotifyId: string,
  userId: string
): Promise<CachedArtist> {
  const artist = await syncArtist(spotifyId);

  // Build reference images list from the synced data
  const images: Array<{
    source: "spotify_profile" | "spotify_cover";
    r2Key: string;
    originalFilename: string | null;
    width: number;
    height: number;
  }> = [];

  if (artist.profileR2Key) {
    images.push({
      source: "spotify_profile",
      r2Key: artist.profileR2Key,
      originalFilename: artist.name,
      width: 640,
      height: 640,
    });
  }

  for (const album of artist.albums) {
    if (album.r2Key) {
      images.push({
        source: "spotify_cover",
        r2Key: album.r2Key,
        originalFilename: album.name,
        width: 640,
        height: 640,
      });
    }
  }

  if (images.length > 0) {
    const inserted = await upsertSpotifyReferences(userId, artist.id, images);
    console.info(
      JSON.stringify({
        event: "spotify_references_populated",
        userId,
        artistId: artist.id,
        inserted,
        total: images.length,
      })
    );
  }

  return artist;
}
