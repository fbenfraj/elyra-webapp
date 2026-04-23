import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import { refinePrompt } from "@/server/services/image-generation";
import {
  getEvaluationFeedback,
  getBatchCount,
} from "@/server/services/evaluation";
import { generationCreateImages } from "@/trigger/generation-create-images";
import { failSession } from "@/server/services/session";

export const generationRefinePrompt = task({
  id: "generation-refine-prompt",
  run: async (
    payload: TaskPayload<Record<string, never>>
  ): Promise<TaskResult<{ refinedPrompt: string }>> => {
    try {
      // Load evaluation feedback from the latest batch
      const feedback = await getEvaluationFeedback(payload.sessionId);

      const result = await refinePrompt(payload.sessionId, feedback);

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        stage: "refine_prompt",
        outcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents,
        durationMs: result.meta.durationMs,
      }));

      if (!result.ok) {
        return result;
      }

      // Determine the next batch number
      const currentBatchCount = await getBatchCount(payload.sessionId);
      const nextBatchNumber = currentBatchCount + 1;

      // Trigger new image generation with the refined prompt
      await generationCreateImages.trigger({
        sessionId: payload.sessionId,
        userId: payload.userId,
        input: { batchNumber: nextBatchNumber, promptOverride: result.output?.refinedPrompt },
      });

      return result;
    } catch {
      await failSession(payload.sessionId, "generating_images").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong refining your images. Give it another try.",
        },
        meta: { costCents: 0, durationMs: 0 },
      };
    }
  },
});
