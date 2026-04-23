import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import { generateImages } from "@/server/services/image-generation";
import { generationEvaluateBatch } from "@/trigger/generation-evaluate-batch";
import { failSession } from "@/server/services/session";
import { MODEL_ROUTING } from "@/config/providers";

export const generationCreateImages = task({
  id: "generation-create-images",
  run: async (
    payload: TaskPayload<{ batchNumber: number; promptOverride?: string }>
  ): Promise<TaskResult<{ imageCount: number; totalCostCents: number }>> => {
    const taskStart = Date.now();
    try {
      const result = await generateImages(
        payload.sessionId,
        payload.userId,
        payload.input.batchNumber,
        payload.input.promptOverride
      );

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        provider: MODEL_ROUTING.imageGeneration.final.provider,
        model: MODEL_ROUTING.imageGeneration.final.model,
        stage: "create_images",
        finalOutcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents ?? 0,
        durationMs: result.meta.durationMs,
      }));

      // If generation succeeded, automatically trigger evaluation
      if (result.ok) {
        await generationEvaluateBatch.trigger({
          sessionId: payload.sessionId,
          userId: payload.userId,
          input: {},
        });
      }

      return result;
    } catch {
      const durationMs = Date.now() - taskStart;
      console.error(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        provider: MODEL_ROUTING.imageGeneration.final.provider,
        model: MODEL_ROUTING.imageGeneration.final.model,
        stage: "create_images",
        finalOutcome: "failed",
        costCents: 0,
        durationMs,
      }));
      await failSession(payload.sessionId, "generating_images").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong generating your images. Give it another try.",
        },
        meta: { costCents: 0, durationMs },
      };
    }
  },
});
