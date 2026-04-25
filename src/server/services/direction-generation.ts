import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod/v4";
import { db } from "@/server/db";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { eq, desc } from "drizzle-orm";
import { getImageAdapter } from "@/server/services/provider-routing";
import { uploadImageFromUrl, getSignedImageUrl } from "@/server/services/storage";
import { updateSessionStatus, failSession } from "@/server/services/session";
import { getSessionReferenceUrls } from "@/server/services/reference-images";
import { getKontextReferencePrefix } from "@/config/providers";

/** Stored in DB — uses stable R2 keys, not expiring signed URLs. */
type StoredDirection = {
  id: string;
  heroImageKey: string;
  moodLabel: string;
  tags: string[];
  supportingImageKeys: string[];
  colorPalette: string[];
  description: string;
};

type StoredDirectionData = { directions: StoredDirection[] };
import type { VisualSpec } from "@/lib/schemas/visual-spec";
import type { Direction } from "@/lib/schemas/direction";
import type { TaskResult } from "@/types/task";
import {
  DIRECTION_PROMPT_MODEL,
  DIRECTION_COUNT,
  DIRECTION_SUPPORTING_IMAGES,
  DIRECTION_IMAGE_WIDTH,
  DIRECTION_IMAGE_HEIGHT,
  FAL_PREVIEW_MODEL,
} from "@/config/providers";

const directionPromptSchema = z.object({
  directions: z.array(
    z.object({
      approach: z
        .string()
        .describe("One of: literal, conceptual, atmospheric"),
      moodLabel: z
        .string()
        .describe(
          "Short mood phrase for the direction, e.g. 'Dark cinematic / urban isolation'"
        ),
      tags: z
        .array(z.string())
        .min(2)
        .max(3)
        .describe("2-3 descriptive tags"),
      colorPalette: z
        .array(z.string())
        .length(5)
        .describe("5 hex color codes defining the visual palette"),
      description: z
        .string()
        .describe("2-3 sentence description of this creative direction"),
      imagePrompt: z
        .string()
        .describe(
          "Detailed image generation prompt for fal.ai Flux Schnell. Describe the visual scene, composition, lighting, colors, style."
        ),
    })
  ).min(2).max(3),
});

const DIRECTION_SYSTEM_PROMPT = `You are a creative direction engine for music artists. Given a structured visual specification (VisualSpec), generate ${DIRECTION_COUNT} visually DISTINCT creative directions.

DIRECTION DIFFERENTIATION (CRITICAL):
- Direction 1 (literal): Closest to what the artist described. Direct visual translation.
- Direction 2 (conceptual): Captures the mood through abstraction or metaphor. More artistic interpretation.
- Direction 3 (atmospheric): Focuses on the world/setting of the sound. Environmental storytelling.

Each direction MUST feel fundamentally different — not variations of the same idea.

IMAGE PROMPT RULES:
- Write detailed, specific prompts for Flux Schnell image generation
- Include: subject, composition, lighting, color palette, style, mood
- Avoid: text, words, letters, watermarks, logos
- Target: album cover art, square format, high quality

COLOR PALETTE:
- 5 hex colors per direction that define that direction's visual world
- Colors should differ meaningfully between directions

MOOD LABEL:
- Short, evocative phrase (2-5 words)
- Artist-friendly language, not technical terms`;

export async function generateDirections(
  sessionId: string,
  userId: string,
  visualSpecId: string
): Promise<TaskResult<Direction[]>> {
  const start = Date.now();
  let totalCostCents = 0;

  try {
    // Step 1: Fetch visual spec
    const [spec] = await db
      .select({ specData: visualSpecs.specData })
      .from(visualSpecs)
      .where(eq(visualSpecs.id, visualSpecId));

    if (!spec) {
      return {
        ok: false,
        error: { code: "SPEC_NOT_FOUND", message: "Visual specification not found." },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    const visualSpec = spec.specData as VisualSpec;

    // Fetch reference image URLs for Kontext Multi conditioning
    const referenceUrls = await getSessionReferenceUrls(sessionId);

    // Step 2: Generate differentiated direction prompts via LLM
    const { object: promptResult, usage } = await generateObject({
      model: openai(DIRECTION_PROMPT_MODEL),
      schema: directionPromptSchema,
      system: DIRECTION_SYSTEM_PROMPT,
      prompt: JSON.stringify(visualSpec),
    });

    // Track LLM cost (GPT-4.1: $2/1M input, $8/1M output)
    const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
    const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
    totalCostCents += Math.round((inputCost + outputCost) * 100) / 100;

    // Step 3: Generate images for all directions in parallel
    const imageOptions = {
      width: DIRECTION_IMAGE_WIDTH,
      height: DIRECTION_IMAGE_HEIGHT,
      model: FAL_PREVIEW_MODEL,
      numImages: 1,
      referenceImages: referenceUrls.length > 0 ? referenceUrls : undefined,
    };

    const storedDirections: StoredDirection[] = await Promise.all(
      promptResult.directions.map(async (dir, dirIndex) => {
        const dirId = `${sessionId}-dir-${dirIndex}`;

        // Generate hero image
        const heroPrompt = referenceUrls.length > 0
          ? getKontextReferencePrefix(referenceUrls.length) + dir.imagePrompt
          : dir.imagePrompt;
        const heroResult = await getImageAdapter("preview").generate(heroPrompt, imageOptions);
        totalCostCents += heroResult.costCents;

        // Upload hero to R2
        const heroKey = `sessions/${sessionId}/directions/${dirIndex}/hero.webp`;
        await uploadImageFromUrl(heroKey, heroResult.imageUrl);

        // Generate supporting images in parallel
        const supportingImageKeys = await Promise.all(
          Array.from({ length: DIRECTION_SUPPORTING_IMAGES }, async (_, imgIndex) => {
            const rawSupportPrompt = `${dir.imagePrompt}, variation ${imgIndex + 1}, different composition and angle`;
            const supportPrompt = referenceUrls.length > 0
              ? getKontextReferencePrefix(referenceUrls.length) + rawSupportPrompt
              : rawSupportPrompt;
            const result = await getImageAdapter("preview").generate(supportPrompt, imageOptions);
            totalCostCents += result.costCents;

            const key = `sessions/${sessionId}/directions/${dirIndex}/support-${imgIndex}.webp`;
            await uploadImageFromUrl(key, result.imageUrl);
            return key;
          })
        );

        return {
          id: dirId,
          heroImageKey: heroKey,
          moodLabel: dir.moodLabel,
          tags: dir.tags,
          supportingImageKeys,
          colorPalette: dir.colorPalette,
          description: dir.description,
        };
      })
    );

    // Step 4: Store directions in generation_jobs (stable keys, not signed URLs)
    await db.insert(generationJobs).values({
      sessionId,
      visualSpecId,
      directionData: { directions: storedDirections },
      status: "complete",
    });

    // Step 5: Update session status to selecting (directions ready for selection)
    await updateSessionStatus(sessionId, "selecting");

    // Mint fresh signed URLs for the response
    const directions = await resolveSignedUrls(storedDirections);

    return {
      ok: true,
      output: directions,
      meta: {
        costCents: totalCostCents,
        durationMs: Date.now() - start,
      },
    };
  } catch (err) {
    console.error("[direction-generation] failed:", err);
    await failSession(sessionId, "generating_directions").catch((e) => console.error("[direction-generation] failSession error:", e));

    return {
      ok: false,
      error: {
        code: "DIRECTION_GENERATION_FAILED",
        message: "Something went wrong generating your directions. Give it another try.",
      },
      meta: {
        costCents: totalCostCents,
        durationMs: Date.now() - start,
      },
    };
  }
}

async function resolveSignedUrls(
  stored: StoredDirection[]
): Promise<Direction[]> {
  return Promise.all(
    stored.map(async (dir) => ({
      id: dir.id,
      heroImageUrl: await getSignedImageUrl(dir.heroImageKey),
      moodLabel: dir.moodLabel,
      tags: dir.tags,
      supportingImageUrls: await Promise.all(
        dir.supportingImageKeys.map((key) => getSignedImageUrl(key))
      ),
      colorPalette: dir.colorPalette,
      description: dir.description,
    }))
  );
}

export async function getDirectionsForSession(
  sessionId: string
): Promise<{ generationJobId: string; directions: Direction[] } | null> {
  const jobs = await db
    .select({ id: generationJobs.id, directionData: generationJobs.directionData, createdAt: generationJobs.createdAt })
    .from(generationJobs)
    .where(eq(generationJobs.sessionId, sessionId))
    .orderBy(desc(generationJobs.createdAt));

  if (jobs.length === 0) return null;

  // Return the latest round's directions with job ID
  const data = jobs[0].directionData as StoredDirectionData;
  return {
    generationJobId: jobs[0].id,
    directions: await resolveSignedUrls(data.directions),
  };
}

export type DirectionRound = {
  generationJobId: string;
  directions: Direction[];
};

export async function getAllDirectionRoundsForSession(
  sessionId: string
): Promise<DirectionRound[]> {
  const jobs = await db
    .select({ id: generationJobs.id, directionData: generationJobs.directionData, createdAt: generationJobs.createdAt })
    .from(generationJobs)
    .where(eq(generationJobs.sessionId, sessionId))
    .orderBy(generationJobs.createdAt); // oldest first

  return Promise.all(
    jobs.map(async (job) => {
      const data = job.directionData as StoredDirectionData;
      return {
        generationJobId: job.id,
        directions: await resolveSignedUrls(data.directions),
      };
    })
  );
}
