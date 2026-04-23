import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import { generateImages } from "@/server/services/image-generation";
import { generationEvaluateBatch } from "@/trigger/generation-evaluate-batch";
import { failSession } from "@/server/services/session";

export const generationCreateImages = task({
  id: "generation-create-images",
  run: async (
    payload: TaskPayload<{ batchNumber: number; promptOverride?: string }>
  ): Promise<TaskResult<{ imageCount: number; totalCostCents: number }>> => {
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
        stage: "create_images",
        outcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents,
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
      await failSession(payload.sessionId, "generating_images").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong generating your images. Give it another try.",
        },
        meta: { costCents: 0, durationMs: 0 },
      };
    }
  },
});
