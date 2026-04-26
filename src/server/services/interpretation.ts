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
import { sessionReferenceSelections } from "@/server/db/schema/session-reference-selections";
import { getAssetTypeConfig } from "@/config/asset-types";
import type { AssetTypeId } from "@/config/asset-types";
import { getActiveMoodboard } from "@/server/services/moodboard";
import type { MoodboardSpec } from "@/lib/schemas/moodboard";

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
 * Build a moodboard context string for the LLM to use as a default aesthetic baseline.
 * The brief can override any aspect — the moodboard is defaults, not constraints.
 */
export function buildMoodboardContext(spec: MoodboardSpec): string {
  const parts: string[] = [];
  parts.push("VISUAL IDENTITY (default aesthetic — the brief below can override any aspect):");
  parts.push(`Core direction: ${spec.coreIdea}`);
  parts.push(`Creative tension: ${spec.duality}`);
  parts.push(`Narrative: ${spec.narrative}`);
  parts.push(`Palette: ${spec.palette.join(", ")}`);
  parts.push(`Textures: ${spec.textures.join(", ")}`);
  parts.push(`Environment: ${spec.environment.join(", ")}`);
  parts.push(`Styling: ${spec.styling.join(", ")}`);
  parts.push(`Lighting: ${spec.lighting}`);

  if (spec.culturalReferences.length > 0) {
    parts.push(`Cultural references: ${spec.culturalReferences.join(", ")}`);
  }

  return parts.join("\n");
}

/**
 * Copy pre-downloaded R2 images from artist_albums into session reference_images.
 */
async function copyArtistReferences(
  sessionId: string,
  artistId: string,
  profileR2Key: string | null,
  startPosition: number = 0
): Promise<number> {
  const rows: (typeof referenceImages.$inferInsert)[] = [];
  let position = startPosition;

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

  // Collect all R2 keys that need signed URLs
  const keysToSign: Array<{ r2Key: string; type: string }> = [];
  if (profileR2Key) {
    keysToSign.push({ r2Key: profileR2Key, type: "profile" });
  }
  for (const album of albums) {
    if (album.r2Key) {
      keysToSign.push({ r2Key: album.r2Key, type: "cover" });
    }
  }

  // Sign all URLs in parallel
  const signedUrls = await Promise.all(
    keysToSign.map((k) => getSignedImageUrl(k.r2Key))
  );

  for (let i = 0; i < keysToSign.length; i++) {
    rows.push({
      sessionId,
      type: keysToSign[i].type,
      source: "spotify",
      sourceUrl: signedUrls[i],
      r2Key: keysToSign[i].r2Key,
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

/**
 * Copy moodboard anchor images into session reference_images.
 * Anchors are placed at the lowest positions so they appear first in the reference array.
 */
async function copyMoodboardAnchors(
  sessionId: string,
  anchors: Array<{ imageKey: string; imageUrl: string }>,
  startPosition: number
): Promise<number> {
  if (anchors.length === 0) return 0;

  const rows: (typeof referenceImages.$inferInsert)[] = anchors.map(
    (anchor, i) => ({
      sessionId,
      type: "anchor",
      source: "moodboard",
      sourceUrl: anchor.imageUrl,
      r2Key: anchor.imageKey,
      width: 1024,
      height: 1024,
      position: startPosition + i,
    })
  );

  await db.insert(referenceImages).values(rows);
  return rows.length;
}

export async function runInterpretation(
  sessionId: string,
  userId: string,
  briefText: string,
  assetType: string
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

  // Step 3: Load artist context + moodboard in parallel
  let artistContext: string | null = null;
  let artistId: string | null = null;
  let profileR2Key: string | null = null;
  let moodboardContext: string | null = null;
  let moodboardAnchors: Array<{ imageKey: string; imageUrl: string }> = [];

  const [, moodboard] = await Promise.all([
    // Artist context
    (async () => {
      const settings = await getUserSettings(userId);
      if (!settings.artistId) return;
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
    })(),
    // Moodboard context
    getActiveMoodboard(userId).catch((error) => {
      console.warn(
        JSON.stringify({
          event: "moodboard_context_skipped",
          sessionId,
          detail: error instanceof Error ? error.message : String(error),
        })
      );
      return null;
    }),
  ]);

  if (moodboard?.spec) {
    moodboardContext = buildMoodboardContext(moodboard.spec);
    moodboardAnchors = moodboard.anchors;
  }

  // Step 4: LLM interpretation
  try {
    const assetConfig = getAssetTypeConfig(assetType as AssetTypeId);
    const assetPrefix = `[Asset type: ${assetConfig.label}]\n${assetConfig.interpretationContext}\n\n`;

    let promptWithContext = `${assetPrefix}${briefText}`;

    // Moodboard = default aesthetic baseline (prepended so LLM treats it as context, not instruction)
    if (moodboardContext) {
      promptWithContext = `${moodboardContext}\n\n---\n${promptWithContext}`;
    }

    // Artist context = supplementary signal (appended)
    if (artistContext) {
      promptWithContext += `\n\n---\nArtist context (use this to inform visual choices like color palette, mood, and style):\n${artistContext}`;
    }

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

    // Step 6+7: Store visual spec and update status in parallel
    await Promise.all([
      storeVisualSpec(sessionId, response.spec),
      updateSessionStatus(sessionId, "generating_directions"),
    ]);

    // Step 8: Copy reference images for Kontext Multi conditioning
    // Priority: user-selected > moodboard anchors + Spotify auto
    const [hasUserSelections] = await db
      .select({ id: sessionReferenceSelections.sessionId })
      .from(sessionReferenceSelections)
      .where(eq(sessionReferenceSelections.sessionId, sessionId))
      .limit(1);

    if (!hasUserSelections) {
      let totalCopied = 0;

      // Moodboard anchors first (lowest positions)
      if (moodboardAnchors.length > 0) {
        try {
          const anchorCount = await copyMoodboardAnchors(
            sessionId,
            moodboardAnchors,
            0
          );
          totalCopied += anchorCount;
          console.info(
            JSON.stringify({
              event: "references_copied",
              sessionId,
              count: anchorCount,
              mode: "moodboard_anchors",
            })
          );
        } catch (error) {
          console.warn(
            JSON.stringify({
              event: "reference_copy_failed",
              sessionId,
              source: "moodboard",
              detail: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }

      // Spotify images after moodboard anchors (higher positions)
      if (artistId) {
        try {
          const copied = await copyArtistReferences(
            sessionId,
            artistId,
            profileR2Key,
            totalCopied
          );
          totalCopied += copied;
          console.info(
            JSON.stringify({
              event: "references_copied",
              sessionId,
              count: copied,
              mode: "auto_spotify",
            })
          );
        } catch (error) {
          console.warn(
            JSON.stringify({
              event: "reference_copy_failed",
              sessionId,
              source: "spotify",
              detail: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }
    } else {
      console.info(
        JSON.stringify({
          event: "references_skipped_user_selected",
          sessionId,
        })
      );
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
