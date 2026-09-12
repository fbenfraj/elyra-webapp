// src/server/services/moodboard-directions.ts
import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/server/db";
import { userReferences } from "@/server/db/schema/user-references";
import { eq } from "drizzle-orm";
import { getUserSettings } from "@/server/services/user";
import { getCachedArtist } from "@/server/services/spotify-sync";
import { getActiveMessage } from "@/server/services/message";
import { getSignedImageUrl, uploadImageFromUrl } from "@/server/services/storage";
import { updateMoodboardDirections, failMoodboard } from "@/server/services/moodboard";
import { directionLLMOutputSchema } from "@/lib/schemas/moodboard";
import type { ExplorationDirection } from "@/lib/schemas/moodboard";
import {
  MOODBOARD_DIRECTION_MODEL,
  MOODBOARD_DIRECTION_SYSTEM_PROMPT,
  MOODBOARD_IMAGE_WIDTH,
  MOODBOARD_IMAGE_HEIGHT,
} from "@/config/moodboard";
import {
  FAL_PREVIEW_MODEL,
  FAL_COST_PER_IMAGE_CENTS,
  FAL_KONTEXT_MULTI_MODEL,
  FAL_KONTEXT_COST_PER_IMAGE_CENTS,
  AUTO_REFERENCE_GUIDANCE_SCALE,
  getKontextReferencePrefix,
} from "@/config/providers";
import { fal } from "@fal-ai/client";

export async function generateMoodboardDirections(
  userId: string,
  moodboardId: string
): Promise<{ costCents: number; durationMs: number }> {
  const start = Date.now();
  let totalCostCents = 0;

  try {
    // Step 1: Load Spotify artist data
    const settings = await getUserSettings(userId);
    if (!settings.artistId) {
      throw new Error("No Spotify artist linked — cannot generate moodboard directions");
    }

    const artist = await getCachedArtist(settings.artistId);
    if (!artist) {
      throw new Error(`Cached artist not found for artistId: ${settings.artistId}`);
    }

    // Step 2: Build LLM prompt with artist context
    const activeMessage = await getActiveMessage(userId);
    const artistPrompt = buildArtistPrompt(artist, activeMessage?.output ?? null);

    // Step 3: Generate 6 direction specs via LLM
    const { object: llmOutput, usage } = await generateObject({
      model: openai(MOODBOARD_DIRECTION_MODEL),
      schema: directionLLMOutputSchema,
      system: MOODBOARD_DIRECTION_SYSTEM_PROMPT,
      prompt: artistPrompt,
    });

    // Track LLM cost (GPT-4.1: $2/1M input, $8/1M output)
    const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
    const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
    totalCostCents += Math.round((inputCost + outputCost) * 100) / 100;

    console.info(JSON.stringify({
      event: "moodboard_directions_llm_complete",
      moodboardId,
      userId,
      directionCount: llmOutput.directions.length,
      costCents: totalCostCents,
    }));

    // Step 4: Collect Spotify reference images for Kontext Multi conditioning
    const referenceImageUrls = await collectReferenceImageUrls(userId);

    // Step 5: Generate 6 hero images in parallel
    const directions: ExplorationDirection[] = await Promise.all(
      llmOutput.directions.map(async (dir, index) => {
        const dirId = `${moodboardId}-dir-${index}`;
        const imageKey = `moodboards/${moodboardId}/directions/${index}/hero.png`;

        let imageUrl: string;
        let imageCost: number;

        if (referenceImageUrls.length > 0) {
          // Use Kontext Multi with Spotify references
          const referencePrefix = getKontextReferencePrefix(referenceImageUrls.length);
          const fullPrompt = `${referencePrefix}\n\n${dir.imagePrompt}`;

          let result;
          try {
            result = await fal.subscribe(FAL_KONTEXT_MULTI_MODEL, {
              input: {
                prompt: fullPrompt,
                image_urls: referenceImageUrls,
                num_images: 1,
                output_format: "jpeg",
                guidance_scale: AUTO_REFERENCE_GUIDANCE_SCALE,
              },
            });
          } catch (error) {
            console.error(JSON.stringify({
              event: "moodboard_kontext_multi_error",
              moodboardId,
              directionIndex: index,
              detail: error instanceof Error ? { message: error.message, body: (error as Error & { body?: unknown }).body } : String(error),
            }));
            throw error;
          }

          const image = (result.data as { images?: Array<{ url: string }> }).images?.[0];
          if (!image) throw new Error(`Kontext Multi returned no images for direction ${index}`);
          imageUrl = image.url;
          imageCost = FAL_KONTEXT_COST_PER_IMAGE_CENTS;
        } else {
          // Use plain Flux Pro
          const result = await fal.subscribe(FAL_PREVIEW_MODEL, {
            input: {
              prompt: dir.imagePrompt,
              image_size: { width: MOODBOARD_IMAGE_WIDTH, height: MOODBOARD_IMAGE_HEIGHT },
              num_images: 1,
            },
          });

          const image = (result.data as { images?: Array<{ url: string }> }).images?.[0];
          if (!image) throw new Error(`Flux Pro returned no images for direction ${index}`);
          imageUrl = image.url;
          imageCost = FAL_COST_PER_IMAGE_CENTS;
        }

        totalCostCents += imageCost;

        // Upload to R2
        await uploadImageFromUrl(imageKey, imageUrl);

        return {
          id: dirId,
          title: dir.title,
          narrative: dir.narrative,
          tags: dir.tags,
          colorPalette: dir.colorPalette,
          textures: dir.textures,
          environment: dir.environment,
          lighting: dir.lighting,
          imagePrompt: dir.imagePrompt,
          imageKey,
        };
      })
    );

    // Step 6: Store directions on moodboard and transition to exploring
    await updateMoodboardDirections(moodboardId, directions);

    const durationMs = Date.now() - start;

    console.info(JSON.stringify({
      event: "moodboard_directions_complete",
      moodboardId,
      userId,
      totalCostCents,
      durationMs,
    }));

    return { costCents: totalCostCents, durationMs };
  } catch (error) {
    console.error("[moodboard-directions] failed:", error);
    await failMoodboard(moodboardId).catch(() => {});
    throw error;
  }
}

function buildArtistPrompt(
  artist: {
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
    albums: Array<{ name: string; releaseDate: string; albumType: string }>;
  },
  message?: {
    title: string;
    narrative: string;
    inspiration: string;
    visualDirection: string;
    authenticity: string;
    aesthetic: string;
  } | null
): string {
  const parts: string[] = [];

  parts.push(`Artist: ${artist.name}`);

  if (artist.genres?.length) {
    parts.push(`Genres: ${artist.genres.join(", ")}`);
  }

  if (artist.audioProfile) {
    const ap = artist.audioProfile;
    parts.push(`Audio Profile:`);
    parts.push(`  Energy: ${ap.energy.toFixed(2)} (0=calm, 1=intense)`);
    parts.push(`  Valence: ${ap.valence.toFixed(2)} (0=dark/sad, 1=happy/bright)`);
    parts.push(`  Danceability: ${ap.danceability.toFixed(2)}`);
    parts.push(`  Acousticness: ${ap.acousticness.toFixed(2)}`);
    parts.push(`  Instrumentalness: ${ap.instrumentalness.toFixed(2)}`);
    parts.push(`  Tempo: ${ap.tempo.toFixed(0)} BPM`);
    parts.push(`  Loudness: ${ap.loudness.toFixed(1)} dB`);
  }

  if (artist.albums.length > 0) {
    const recentAlbums = artist.albums.slice(0, 10);
    parts.push(`Recent releases: ${recentAlbums.map((a) => `${a.name} (${a.releaseDate})`).join(", ")}`);
  }

  if (message) {
    parts.push("");
    parts.push("ARTIST MESSAGE");
    parts.push(`Title: ${message.title}`);
    parts.push(`Core narrative: ${message.narrative}`);
    parts.push(`Inspiration: ${message.inspiration}`);
    parts.push(`Visual direction: ${message.visualDirection}`);
    parts.push(`Values & authenticity: ${message.authenticity}`);
    parts.push(`Aesthetic: ${message.aesthetic}`);
  }

  return parts.join("\n");
}

async function collectReferenceImageUrls(userId: string): Promise<string[]> {
  const refs = await db
    .select({ r2Key: userReferences.r2Key })
    .from(userReferences)
    .where(eq(userReferences.userId, userId))
    .limit(4);

  if (refs.length === 0) return [];

  return Promise.all(refs.map((ref) => getSignedImageUrl(ref.r2Key)));
}
