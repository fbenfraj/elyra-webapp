import "server-only";

import { db } from "@/server/db";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import { sessions } from "@/server/db/schema/sessions";
import { eq, and, isNull, desc } from "drizzle-orm";
import type { DirectionContext } from "@/server/providers/image-generation";
import { getSignedImageUrl } from "@/server/services/storage";
import { executeWithFallback } from "@/server/services/provider-executor";
import { FALLBACK_CHAINS } from "@/config/providers";
import { getEvaluationAdapter } from "@/server/services/provider-routing";
import { RUBRIC_WEIGHTS, MIN_PASS_SCORE, getRubricWeights } from "@/config/evaluation";
import type { EvaluationResult } from "@/lib/schemas/evaluation";
import type { TaskResult } from "@/types/task";

/** Direction data shape stored in generation_jobs.directionData */
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

function computeWeightedScore(
  scores: EvaluationResult["scores"],
  weights: typeof RUBRIC_WEIGHTS = RUBRIC_WEIGHTS
): number {
  return (
    scores.composition * weights.composition +
    scores.colorAccuracy * weights.colorAccuracy +
    scores.moodAlignment * weights.moodAlignment +
    scores.textAccuracy * weights.textAccuracy +
    scores.brandConsistency * weights.brandConsistency
  );
}

async function loadDirectionContext(
  sessionId: string
): Promise<DirectionContext | null> {
  // Load session to get selected direction ID
  const [session] = await db
    .select({
      selectedDirectionId: sessions.selectedDirectionId,
      selectedGenerationJobId: sessions.selectedGenerationJobId,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.selectedDirectionId === null) {
    return null;
  }

  // Load generation job
  const jobQuery = session.selectedGenerationJobId
    ? eq(generationJobs.id, session.selectedGenerationJobId)
    : eq(generationJobs.sessionId, sessionId);

  const [job] = await db
    .select({
      id: generationJobs.id,
      directionData: generationJobs.directionData,
      visualSpecId: generationJobs.visualSpecId,
    })
    .from(generationJobs)
    .where(jobQuery)
    .orderBy(desc(generationJobs.createdAt))
    .limit(1);

  if (!job) {
    return null;
  }

  const directionData = job.directionData as StoredDirectionData;
  const direction = directionData.directions.find(
    (d) => d.id === session.selectedDirectionId
  );

  if (!direction) {
    return null;
  }

  // Load visual spec for summary
  let visualSpecSummary = "";
  const [spec] = await db
    .select({ specData: visualSpecs.specData })
    .from(visualSpecs)
    .where(eq(visualSpecs.id, job.visualSpecId));

  if (spec) {
    const specData = spec.specData as Record<string, unknown>;
    visualSpecSummary = [
      specData.mood ? `Mood: ${specData.mood}` : null,
      specData.style ? `Style: ${specData.style}` : null,
      specData.composition ? `Composition: ${specData.composition}` : null,
    ]
      .filter(Boolean)
      .join(". ");
  }

  return {
    moodLabel: direction.moodLabel,
    colorPalette: direction.colorPalette,
    description: direction.description,
    visualSpecSummary,
  };
}

export async function evaluateBatch(
  sessionId: string,
  userId: string
): Promise<
  TaskResult<{
    evaluatedCount: number;
    passingCount: number;
    totalCostCents: number;
  }>
> {
  const start = Date.now();
  let totalCostCents = 0;

  try {
    // Load direction context for evaluation
    const directionContext = await loadDirectionContext(sessionId);
    if (!directionContext) {
      return {
        ok: false,
        error: {
          code: "NO_DIRECTION_CONTEXT",
          message: "Could not load direction context for evaluation",
        },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    // Load visual spec to extract genre for rubric weight calibration
    const [specRow] = await db
      .select({ specData: visualSpecs.specData })
      .from(visualSpecs)
      .where(eq(visualSpecs.sessionId, sessionId))
      .limit(1);
    const specData = specRow?.specData as Record<string, unknown> | undefined;
    const genre =
      typeof specData?.genreContext === "string"
        ? specData.genreContext
        : undefined;
    const rubricWeights = getRubricWeights(genre);

    // Load all unevaluated attempts for this session
    const unevaluated = await db
      .select({
        id: generationAttempts.id,
        imageKey: generationAttempts.imageKey,
      })
      .from(generationAttempts)
      .where(
        and(
          eq(generationAttempts.sessionId, sessionId),
          isNull(generationAttempts.evaluationScore)
        )
      );

    if (unevaluated.length === 0) {
      return {
        ok: true,
        output: { evaluatedCount: 0, passingCount: 0, totalCostCents: 0 },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    let passingCount = 0;

    // Evaluate each image
    const evaluationResults = await Promise.allSettled(
      unevaluated.map(async (attempt) => {
        const signedUrl = await getSignedImageUrl(attempt.imageKey);

        const { result, costCents } = await executeWithFallback(
          FALLBACK_CHAINS.evaluation,
          async (provider) => {
            const adapter = getEvaluationAdapter(
              provider === FALLBACK_CHAINS.evaluation[0] ? "primary" : "fallback"
            );
            return adapter.evaluate(signedUrl, rubricWeights, directionContext);
          },
          { sessionId }
        );

        totalCostCents += costCents;

        // Recompute weighted score to ensure consistency with our weights
        const weightedScore = computeWeightedScore(result.scores, rubricWeights);

        if (weightedScore >= MIN_PASS_SCORE) {
          passingCount++;
        }

        // Store evaluation results
        await db
          .update(generationAttempts)
          .set({
            evaluationScore: weightedScore,
            evaluationFeedback: result,
          })
          .where(eq(generationAttempts.id, attempt.id));

        return { attemptId: attempt.id, score: weightedScore, result };
      })
    );

    // Handle partial failures: retry failed evaluations once
    const failed = evaluationResults.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );

    if (failed.length > 0) {
      // For failed evaluations, set score to 0 (won't pass threshold but preserved)
      const failedAttemptIds = unevaluated
        .filter((_, i) => evaluationResults[i]?.status === "rejected")
        .map((a) => a.id);

      for (const attemptId of failedAttemptIds) {
        await db
          .update(generationAttempts)
          .set({
            evaluationScore: 0,
            evaluationFeedback: {
              scores: {
                composition: 0,
                colorAccuracy: 0,
                moodAlignment: 0,
                textAccuracy: 0,
                brandConsistency: 0,
              },
              overallScore: 0,
              feedback: "Evaluation failed",
              strengths: [],
              weaknesses: ["Evaluation could not be completed"],
            },
          })
          .where(eq(generationAttempts.id, attemptId));
      }
    }

    const evaluatedCount =
      evaluationResults.filter((r) => r.status === "fulfilled").length +
      failed.length;

    return {
      ok: true,
      output: {
        evaluatedCount,
        passingCount,
        totalCostCents,
      },
      meta: {
        costCents: totalCostCents,
        durationMs: Date.now() - start,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: "EVALUATION_FAILED",
        message: "Something went wrong evaluating images.",
      },
      meta: {
        costCents: totalCostCents,
        durationMs: Date.now() - start,
      },
    };
  }
}

export async function getCuratedImages(
  sessionId: string
): Promise<{
  images: { id: string; imageUrl: string; batchNumber: number }[];
}> {
  // Load ALL evaluated attempts for this session, ranked by score descending
  const allAttempts = await db
    .select({
      id: generationAttempts.id,
      imageKey: generationAttempts.imageKey,
      evaluationScore: generationAttempts.evaluationScore,
      batchNumber: generationAttempts.batchNumber,
    })
    .from(generationAttempts)
    .where(eq(generationAttempts.sessionId, sessionId))
    .orderBy(desc(generationAttempts.evaluationScore));

  // Filter to passing images
  const passing = allAttempts.filter(
    (a) => a.evaluationScore !== null && a.evaluationScore >= MIN_PASS_SCORE
  );

  // If no images pass, graceful degradation: return best-scoring across all batches
  const candidates = passing.length > 0 ? passing : allAttempts;

  // Generate signed URLs for each image (no scores in response)
  const images = await Promise.all(
    candidates.map(async (attempt) => ({
      id: attempt.id,
      imageUrl: await getSignedImageUrl(attempt.imageKey),
      batchNumber: attempt.batchNumber,
    }))
  );

  return { images };
}

/**
 * Get evaluation feedback for all evaluated attempts in a session.
 * Used internally by prompt refinement — never exposed to client.
 */
export async function getEvaluationFeedback(
  sessionId: string
): Promise<EvaluationResult[]> {
  const attempts = await db
    .select({
      evaluationFeedback: generationAttempts.evaluationFeedback,
    })
    .from(generationAttempts)
    .where(
      and(
        eq(generationAttempts.sessionId, sessionId),
        // Only get attempts that have been evaluated (score is not null)
      )
    )
    .orderBy(desc(generationAttempts.evaluationScore));

  return attempts
    .filter((a) => a.evaluationFeedback !== null)
    .map((a) => a.evaluationFeedback as EvaluationResult);
}

/**
 * Count distinct batch numbers in generation_attempts for retry tracking.
 */
export async function getBatchCount(sessionId: string): Promise<number> {
  const attempts = await db
    .select({ batchNumber: generationAttempts.batchNumber })
    .from(generationAttempts)
    .where(eq(generationAttempts.sessionId, sessionId));

  const uniqueBatches = new Set(attempts.map((a) => a.batchNumber));
  return uniqueBatches.size;
}
