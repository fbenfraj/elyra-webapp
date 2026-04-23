import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import { refinePrompt } from "@/server/services/image-generation";
import {
  getEvaluationFeedback,
  getBatchCount,
} from "@/server/services/evaluation";
import { generationCreateImages } from "@/trigger/generation-create-images";
import { failSession } from "@/server/services/session";
import { MODEL_ROUTING } from "@/config/providers";

export const generationRefinePrompt = task({
  id: "generation-refine-prompt",
  run: async (
    payload: TaskPayload<Record<string, never>>
  ): Promise<TaskResult<{ refinedPrompt: string }>> => {
    const taskStart = Date.now();
    try {
      // Load evaluation feedback from the latest batch
      const feedback = await getEvaluationFeedback(payload.sessionId);

      const result = await refinePrompt(payload.sessionId, feedback);

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        provider: MODEL_ROUTING.interpretation.primary.provider,
        model: MODEL_ROUTING.interpretation.primary.model,
        stage: "refine_prompt",
        finalOutcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents ?? 0,
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
      const durationMs = Date.now() - taskStart;
      console.error(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        provider: MODEL_ROUTING.interpretation.primary.provider,
        model: MODEL_ROUTING.interpretation.primary.model,
        stage: "refine_prompt",
        finalOutcome: "failed",
        costCents: 0,
        durationMs,
      }));
      await failSession(payload.sessionId, "prompt_refinement").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong refining your images. Give it another try.",
        },
        meta: { costCents: 0, durationMs },
      };
    }
  },
});
