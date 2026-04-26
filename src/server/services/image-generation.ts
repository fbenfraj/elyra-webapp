import "server-only";

import { getAssetTypeConfig } from "@/config/asset-types";
import type { AssetTypeId } from "@/config/asset-types";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { eq, and, desc } from "drizzle-orm";
import { getImageAdapter } from "@/server/services/provider-routing";
import { uploadImageFromUrl } from "@/server/services/storage";
import { executeWithFallback } from "@/server/services/provider-executor";
import { FALLBACK_CHAINS } from "@/config/providers";
import { updateSessionStatus, failSession } from "@/server/services/session";
import { checkPackBoundary } from "@/server/services/payment";
import { checkSessionBudget } from "@/server/services/budget";
import { refinePromptWithFeedback } from "@/server/providers/openai";
import {
  FAL_FINAL_MODEL,
  FINAL_IMAGE_COUNT,
  FINAL_IMAGE_WIDTH,
  FINAL_IMAGE_HEIGHT,
  getKontextReferencePrefix,
  USER_SELECTED_REFERENCE_PREFIX,
  USER_SELECTED_GUIDANCE_SCALE,
  AUTO_REFERENCE_GUIDANCE_SCALE,
} from "@/config/providers";
import { sessionReferenceSelections } from "@/server/db/schema/session-reference-selections";
import { getSessionReferencesWithUrls } from "@/server/services/reference-images";
import type { TaskResult } from "@/types/task";
import type { EvaluationResult } from "@/lib/schemas/evaluation";

/** Check if an error is a content policy violation from any provider. */
function isContentPolicyError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("content policy") ||
    lower.includes("safety") ||
    lower.includes("nsfw") ||
    lower.includes("moderation") ||
    lower.includes("inappropriate") ||
    lower.includes("violat")
  );
}

/** Direction data as stored in generation_jobs.directionData */
type StoredDirection = {
  id: string;
  heroImageKey: string;
  moodLabel: string;
  tags: string[];
  supportingImageKeys: string[];
  colorPalette: string[];
  description: string;
};

type StoredDirectionData = {
  directions: StoredDirection[];
};

function buildPrompt(direction: StoredDirection, promptSuffix: string): string {
  const palette = direction.colorPalette.join(", ");
  return [
    direction.description,
    `Mood: ${direction.moodLabel}.`,
    `Color palette: ${palette}.`,
    `Tags: ${direction.tags.join(", ")}.`,
    promptSuffix,
  ].join(" ");
}

export async function generateImages(
  sessionId: string,
  userId: string,
  batchNumber: number = 1,
  promptOverride?: string
): Promise<
  TaskResult<{ imageCount: number; totalCostCents: number }>
> {
  const start = Date.now();
  let totalCostCents = 0;

  try {
    // Step 1: Validate session ownership and status
    const [session] = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        status: sessions.status,
        selectedDirectionId: sessions.selectedDirectionId,
        selectedGenerationJobId: sessions.selectedGenerationJobId,
        assetType: sessions.assetType,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!session || session.userId !== userId) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    const assetConfig = getAssetTypeConfig(
      (session.assetType ?? "album_cover") as AssetTypeId
    );

    if (
      session.status !== "paid" &&
      session.status !== "direction_selected" &&
      session.status !== "generating_images" &&
      session.status !== "evaluating"
    ) {
      return {
        ok: false,
        error: {
          code: "INVALID_STATUS",
          message: "Session is not paid or ready for image generation",
        },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    // Step 2: Check pack boundary (regen limit)
    const boundary = await checkPackBoundary(sessionId, userId);
    if (!boundary.isPaid) {
      return {
        ok: false,
        error: { code: "UNPAID", message: "Session is not paid" },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    if (batchNumber > 1 && !boundary.canRegenerate) {
      return {
        ok: false,
        error: {
          code: "REGEN_LIMIT",
          message: "Regeneration limit reached",
        },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    // Step 2b: Check session budget
    const budget = await checkSessionBudget(sessionId, userId);
    if (!budget.allowed) {
      // Budget exhausted: stop cleanly, deliver best results so far
      await updateSessionStatus(sessionId, "selecting");
      return {
        ok: false,
        error: {
          code: "BUDGET_EXCEEDED",
          message: "Session budget reached. Showing your best results so far.",
        },
        meta: {
          costCents: 0,
          durationMs: Date.now() - start,
        },
      };
    }

    // Step 3: Load selected direction from generation job
    if (session.selectedDirectionId === null) {
      return {
        ok: false,
        error: {
          code: "NO_DIRECTION",
          message: "No direction selected for this session",
        },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    const jobQuery = session.selectedGenerationJobId
      ? eq(generationJobs.id, session.selectedGenerationJobId)
      : eq(generationJobs.sessionId, sessionId);

    const [job] = await db
      .select({
        id: generationJobs.id,
        directionData: generationJobs.directionData,
      })
      .from(generationJobs)
      .where(jobQuery)
      .orderBy(desc(generationJobs.createdAt))
      .limit(1);

    if (!job) {
      return {
        ok: false,
        error: {
          code: "JOB_NOT_FOUND",
          message: "Generation job not found",
        },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    const directionData = job.directionData as StoredDirectionData;
    const direction = directionData.directions.find(
      (d) => d.id === session.selectedDirectionId
    );

    if (!direction) {
      return {
        ok: false,
        error: {
          code: "DIRECTION_NOT_FOUND",
          message: "Selected direction not found in job data",
        },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    // Step 4: Update status to generating_images (skip if already there —
    // the router may have set it before triggering the task)
    if (session.status !== "generating_images") {
      await updateSessionStatus(sessionId, "generating_images");
    }

    // Step 5: Generate batch of images
    const basePrompt = promptOverride ?? buildPrompt(direction, assetConfig.promptSuffix);

    // Fetch reference images with URLs and metadata in a single DB call
    const { urls: referenceUrls, hasMoodboardAnchors } = await getSessionReferencesWithUrls(sessionId);

    // Determine if user explicitly selected references
    let isUserSelected = false;
    if (referenceUrls.length > 0) {
      const [sel] = await db
        .select({ id: sessionReferenceSelections.sessionId })
        .from(sessionReferenceSelections)
        .where(eq(sessionReferenceSelections.sessionId, sessionId))
        .limit(1);
      isUserSelected = !!sel;
    }

    const guidanceScale = isUserSelected
      ? USER_SELECTED_GUIDANCE_SCALE
      : AUTO_REFERENCE_GUIDANCE_SCALE;
    const referencePrefix = isUserSelected
      ? USER_SELECTED_REFERENCE_PREFIX
      : getKontextReferencePrefix(referenceUrls.length, hasMoodboardAnchors);

    const imageOptions = {
      width: assetConfig.width,
      height: assetConfig.height,
      model: FAL_FINAL_MODEL,
      numImages: 1,
      referenceImages: referenceUrls.length > 0 ? referenceUrls : undefined,
      guidanceScale: referenceUrls.length > 0 ? guidanceScale : undefined,
    };

    const results = await Promise.allSettled(
      Array.from({ length: FINAL_IMAGE_COUNT }, async (_, i) => {
        const rawPrompt =
          i === 0
            ? basePrompt
            : `${basePrompt} Variation ${i + 1}, different composition and angle.`;

        // Prepend Kontext reference prefix when references are available
        const prompt =
          referenceUrls.length > 0
            ? referencePrefix + rawPrompt
            : rawPrompt;

        let genResult;
        try {
          genResult = await executeWithFallback(
            FALLBACK_CHAINS.imageGeneration.final,
            async () => getImageAdapter("final").generate(prompt, imageOptions),
            { sessionId }
          );
        } catch (error) {
          // If Kontext Multi fails and we had references, retry without them
          if (referenceUrls.length > 0) {
            console.warn(
              JSON.stringify({
                event: "reference_fallback",
                sessionId,
                reason: "kontext_failed",
                detail: error instanceof Error ? error.message : String(error),
              })
            );
            genResult = await executeWithFallback(
              FALLBACK_CHAINS.imageGeneration.final,
              async () =>
                getImageAdapter("final").generate(rawPrompt, {
                  width: assetConfig.width,
                  height: assetConfig.height,
                  model: FAL_FINAL_MODEL,
                  numImages: 1,
                }),
              { sessionId }
            );
          } else {
            throw error;
          }
        }
        totalCostCents += genResult.costCents;

        // Generate a temporary ID for the R2 key
        const attemptId = crypto.randomUUID();
        const imageKey = `sessions/${sessionId}/attempts/${attemptId}.webp`;

        // Upload to R2
        await uploadImageFromUrl(imageKey, genResult.imageUrl);

        // Store attempt row
        const [attempt] = await db
          .insert(generationAttempts)
          .values({
            sessionId,
            generationJobId: job.id,
            imageKey,
            promptUsed: prompt,
            model: FAL_FINAL_MODEL,
            provider: "fal",
            costCents: genResult.costCents,
            durationMs: genResult.durationMs,
            batchNumber,
          })
          .returning({ id: generationAttempts.id });

        return attempt;
      })
    );

    const succeeded = results.filter(
      (r): r is PromiseFulfilledResult<{ id: string }> =>
        r.status === "fulfilled"
    );

    if (succeeded.length === 0) {
      // Check if any failures were content policy related
      const hasContentPolicy = results.some(
        (r) =>
          r.status === "rejected" &&
          isContentPolicyError(r.reason)
      );

      if (hasContentPolicy) {
        await failSession(sessionId, "content_policy");
        return {
          ok: false,
          error: {
            code: "CONTENT_POLICY",
            message: "We couldn't generate that image. Try adjusting your brief.",
          },
          meta: { costCents: totalCostCents, durationMs: Date.now() - start },
        };
      }

      await failSession(sessionId, "generating_images");
      return {
        ok: false,
        error: {
          code: "ALL_IMAGES_FAILED",
          message: "Something went wrong generating your images. Give it another try.",
        },
        meta: { costCents: totalCostCents, durationMs: Date.now() - start },
      };
    }

    // Step 6: Update status to evaluating
    await updateSessionStatus(sessionId, "evaluating");

    console.info(
      JSON.stringify({
        event: "generation_attempt_complete",
        sessionId,
        userId,
        provider: "fal",
        model: FAL_FINAL_MODEL,
        costCents: totalCostCents,
        durationMs: Date.now() - start,
        imageCount: succeeded.length,
        batchNumber,
      })
    );

    return {
      ok: true,
      output: {
        imageCount: succeeded.length,
        totalCostCents,
      },
      meta: {
        costCents: totalCostCents,
        durationMs: Date.now() - start,
      },
    };
  } catch (err) {
    if (isContentPolicyError(err)) {
      await failSession(sessionId, "content_policy").catch((err) => console.error("[image-generation] failSession error:", err));
      return {
        ok: false,
        error: {
          code: "CONTENT_POLICY",
          message: "We couldn't generate that image. Try adjusting your brief.",
        },
        meta: { costCents: totalCostCents, durationMs: Date.now() - start },
      };
    }

    await failSession(sessionId, "generating_images").catch((err) => console.error("[image-generation] failSession error:", err));

    return {
      ok: false,
      error: {
        code: "IMAGE_GENERATION_FAILED",
        message:
          "Something went wrong generating your images. Give it another try.",
      },
      meta: {
        costCents: totalCostCents,
        durationMs: Date.now() - start,
      },
    };
  }
}

/**
 * Refine the generation prompt using VLM feedback from failed evaluations.
 * Uses GPT-4.1 to rewrite the prompt, addressing identified weaknesses.
 */
export async function refinePrompt(
  sessionId: string,
  evaluationFeedback: EvaluationResult[]
): Promise<
  TaskResult<{ refinedPrompt: string }>
> {
  const start = Date.now();

  try {
    // Load the most recent prompt used for this session
    const [latestAttempt] = await db
      .select({ promptUsed: generationAttempts.promptUsed })
      .from(generationAttempts)
      .where(eq(generationAttempts.sessionId, sessionId))
      .orderBy(desc(generationAttempts.createdAt))
      .limit(1);

    if (!latestAttempt) {
      return {
        ok: false,
        error: {
          code: "NO_ATTEMPTS",
          message: "No generation attempts found to refine from",
        },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    const { refinedPrompt, costCents } =
      await refinePromptWithFeedback(
        latestAttempt.promptUsed,
        evaluationFeedback
      );

    return {
      ok: true,
      output: { refinedPrompt },
      meta: {
        costCents,
        durationMs: Date.now() - start,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "REFINEMENT_FAILED",
        message: "Failed to refine the generation prompt",
      },
      meta: { costCents: 0, durationMs: Date.now() - start },
    };
  }
}

/**
 * Select an image attempt for a session.
 * Sets all attempts to selected=false, then the chosen one to selected=true.
 */
export async function selectImage(
  sessionId: string,
  userId: string,
  attemptId: string
): Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }> {
  // Verify session ownership
  const [session] = await db
    .select({ id: sessions.id, userId: sessions.userId, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.userId !== userId) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Session not found" } };
  }

  if (session.status !== "selecting") {
    return { ok: false, error: { code: "INVALID_STATUS", message: "Session is not in selecting phase" } };
  }

  // Verify attempt belongs to this session
  const [attempt] = await db
    .select({ id: generationAttempts.id })
    .from(generationAttempts)
    .where(
      and(
        eq(generationAttempts.id, attemptId),
        eq(generationAttempts.sessionId, sessionId)
      )
    );

  if (!attempt) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Image not found" } };
  }

  // Deselect all, then select the chosen one
  await db
    .update(generationAttempts)
    .set({ selected: false })
    .where(eq(generationAttempts.sessionId, sessionId));

  await db
    .update(generationAttempts)
    .set({ selected: true })
    .where(eq(generationAttempts.id, attemptId));

  return { ok: true };
}

/**
 * Confirm the selected image and move session to packaging.
 */
export async function confirmSelection(
  sessionId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: { code: string; message: string } }> {
  // Verify session ownership
  const [session] = await db
    .select({ id: sessions.id, userId: sessions.userId, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.userId !== userId) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Session not found" } };
  }

  if (session.status !== "selecting") {
    return { ok: false, error: { code: "INVALID_STATUS", message: "Session is not in selecting phase" } };
  }

  // Verify there is a selected attempt
  const [selected] = await db
    .select({ id: generationAttempts.id })
    .from(generationAttempts)
    .where(
      and(
        eq(generationAttempts.sessionId, sessionId),
        eq(generationAttempts.selected, true)
      )
    );

  if (!selected) {
    return { ok: false, error: { code: "NO_SELECTION", message: "No image selected" } };
  }

  // Update session status to packaging
  await updateSessionStatus(sessionId, "packaging");

  return { ok: true };
}
