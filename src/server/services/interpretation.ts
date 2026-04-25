import "server-only";

import type { TaskResult } from "@/types/task";
import type { VisualSpec } from "@/lib/schemas/visual-spec";
import { moderateBrief, interpretBrief } from "@/server/providers/openai";
import { updateSessionStatus, failSession } from "@/server/services/session";
import { getUserSettings } from "@/server/services/user";
import { getCachedArtist } from "@/server/services/spotify-sync";
import { executeWithFallback } from "@/server/services/provider-executor";
import { FALLBACK_CHAINS } from "@/config/providers";
import { storeVisualSpec } from "@/server/services/visual-spec-store";
import { db } from "@/server/db";
import { referenceImages } from "@/server/db/schema/reference-images";
import { artistAlbums } from "@/server/db/schema/artist-albums";
import { eq, desc } from "drizzle-orm";
import { getSignedImageUrl } from "@/server/services/storage";

const CONFIDENCE_THRESHOLD = 0.7;
const MAX_REFERENCE_ALBUMS = 5;

export type InterpretationOutput =
  | { type: "spec"; spec: VisualSpec }
  | { type: "follow_up"; questions: string[] };

/**
 * Build an artist context string for the LLM to use during interpretation.
 */
function buildArtistContext(artist: {
  name: string;
  genres: string[] | null;
  audioProfile: {
    energy: number;
    valence: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    tempo: number;
    loudness: number;
  } | null;
  albums: Array<{ name: string; releaseDate: string }>;
}): string {
  const parts: string[] = [];
  parts.push(`Artist: ${artist.name}`);

  if (artist.genres && artist.genres.length > 0) {
    parts.push(`Genres: ${artist.genres.join(", ")}`);
  }

  if (artist.audioProfile) {
    const ap = artist.audioProfile;
    parts.push(
      `Audio profile (averaged from top tracks): energy=${ap.energy}, valence/mood=${ap.valence}, danceability=${ap.danceability}, acousticness=${ap.acousticness}, tempo=${ap.tempo}bpm`
    );
  }

  if (artist.albums.length > 0) {
    const recent = artist.albums.slice(0, 5);
    parts.push(
      `Recent releases: ${recent.map((a) => `"${a.name}" (${a.releaseDate})`).join(", ")}`
    );
  }

  return parts.join("\n");
}

/**
 * Copy pre-downloaded R2 images from artist_albums into session reference_images.
 */
async function copyArtistReferences(
  sessionId: string,
  artistId: string,
  profileR2Key: string | null
): Promise<number> {
  const rows: (typeof referenceImages.$inferInsert)[] = [];
  let position = 0;

  // Profile image
  if (profileR2Key) {
    const signedUrl = await getSignedImageUrl(profileR2Key);
    rows.push({
      sessionId,
      type: "profile",
      source: "spotify",
      sourceUrl: signedUrl,
      r2Key: profileR2Key,
      width: 640,
      height: 640,
      position,
    });
    position++;
  }

  // Most recent album covers with R2 keys
  const albums = await db
    .select({
      r2Key: artistAlbums.r2Key,
      coverImageUrl: artistAlbums.coverImageUrl,
    })
    .from(artistAlbums)
    .where(eq(artistAlbums.artistId, artistId))
    .orderBy(desc(artistAlbums.releaseDate))
    .limit(MAX_REFERENCE_ALBUMS);

  for (const album of albums) {
    if (!album.r2Key) continue;
    const signedUrl = await getSignedImageUrl(album.r2Key);
    rows.push({
      sessionId,
      type: "cover",
      source: "spotify",
      sourceUrl: signedUrl,
      r2Key: album.r2Key,
      width: 640,
      height: 640,
      position,
    });
    position++;
  }

  if (rows.length > 0) {
    await db.insert(referenceImages).values(rows);
  }

  return rows.length;
}

export async function runInterpretation(
  sessionId: string,
  userId: string,
  briefText: string
): Promise<TaskResult<InterpretationOutput>> {
  const start = Date.now();

  // Step 1: Content moderation pre-screen (before any billable call)
  const moderation = await moderateBrief(briefText);
  if (moderation.flagged) {
    return {
      ok: false,
      error: {
        code: "CONTENT_POLICY",
        message:
          "We couldn't process this brief. Try describing your vision with different words.",
      },
      meta: {
        costCents: 0,
        durationMs: Date.now() - start,
      },
    };
  }

  // Step 2: Update session status to 'interpreting'
  await updateSessionStatus(sessionId, "interpreting");

  // Step 3: Load artist context for LLM enrichment
  let artistContext: string | null = null;
  let artistId: string | null = null;
  let profileR2Key: string | null = null;

  const settings = await getUserSettings(userId);
  if (settings.artistId) {
    try {
      const artist = await getCachedArtist(settings.artistId);
      if (artist) {
        artistId = artist.id;
        profileR2Key = artist.profileR2Key;
        artistContext = buildArtistContext(artist);
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "artist_context_skipped",
          sessionId,
          detail: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // Step 4: LLM interpretation
  try {
    const promptWithContext = artistContext
      ? `${briefText}\n\n---\nArtist context (use this to inform visual choices like color palette, mood, and style):\n${artistContext}`
      : briefText;

    const result = await executeWithFallback(
      FALLBACK_CHAINS.interpretation,
      async () => interpretBrief(promptWithContext),
      { sessionId }
    );
    const { response } = result;

    // Step 5: Check confidence — return follow-up questions if too vague
    if (
      response.confidence < CONFIDENCE_THRESHOLD ||
      !response.spec
    ) {
      await updateSessionStatus(sessionId, "pending");

      return {
        ok: true,
        output: {
          type: "follow_up",
          questions:
            response.followUpQuestions.length > 0
              ? response.followUpQuestions
              : [
                  "Any artist or album cover that captures the feeling you're after?",
                ],
        },
        meta: {
          costCents: result.costCents,
          durationMs: Date.now() - start,
        },
      };
    }

    // Step 6: Store visual spec
    await storeVisualSpec(sessionId, response.spec);

    // Step 7: Update session status to 'generating_directions'
    await updateSessionStatus(sessionId, "generating_directions");

    // Step 8: Copy pre-downloaded reference images from artist cache
    if (artistId) {
      try {
        const copied = await copyArtistReferences(
          sessionId,
          artistId,
          profileR2Key
        );
        console.info(
          JSON.stringify({
            event: "references_copied",
            sessionId,
            count: copied,
          })
        );
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: "reference_copy_failed",
            sessionId,
            detail: error instanceof Error ? error.message : String(error),
          })
        );
      }
    }

    return {
      ok: true,
      output: { type: "spec", spec: response.spec },
      meta: {
        costCents: result.costCents,
        durationMs: Date.now() - start,
      },
    };
  } catch (err) {
    console.error("[interpretation] failed:", err);
    await failSession(sessionId, "interpreting").catch((e) =>
      console.error("[interpretation] failSession error:", e)
    );

    return {
      ok: false,
      error: {
        code: "INTERPRETATION_FAILED",
        message:
          "Something went wrong interpreting your brief. Give it another try.",
      },
      meta: {
        costCents: 0,
        durationMs: Date.now() - start,
      },
    };
  }
}
