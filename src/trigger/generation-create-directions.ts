import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import type { Direction } from "@/lib/schemas/direction";
import { generateDirections } from "@/server/services/direction-generation";
import { failSession } from "@/server/services/session";
import { MODEL_ROUTING } from "@/config/providers";

export const generationCreateDirections = task({
  id: "generation-create-directions",
  run: async (
    payload: TaskPayload<{ visualSpecId: string }>
  ): Promise<TaskResult<Direction[]>> => {
    const taskStart = Date.now();
    try {
      const result = await generateDirections(
        payload.sessionId,
        payload.userId,
        payload.input.visualSpecId
      );

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        provider: MODEL_ROUTING.imageGeneration.preview.provider,
        model: MODEL_ROUTING.imageGeneration.preview.model,
        stage: "create_directions",
        finalOutcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents ?? 0,
        durationMs: result.meta.durationMs,
      }));

      return result;
    } catch {
      const durationMs = Date.now() - taskStart;
      console.error(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        provider: MODEL_ROUTING.imageGeneration.preview.provider,
        model: MODEL_ROUTING.imageGeneration.preview.model,
        stage: "create_directions",
        finalOutcome: "failed",
        costCents: 0,
        durationMs,
      }));
      await failSession(payload.sessionId, "generating_directions").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong generating your directions. Give it another try.",
        },
        meta: { costCents: 0, durationMs },
      };
    }
  },
});
