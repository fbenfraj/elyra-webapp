import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import type { Direction } from "@/lib/schemas/direction";
import { generateDirections } from "@/server/services/direction-generation";
import { failSession } from "@/server/services/session";

export const generationCreateDirections = task({
  id: "generation-create-directions",
  run: async (
    payload: TaskPayload<{ visualSpecId: string }>
  ): Promise<TaskResult<Direction[]>> => {
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
        stage: "create_directions",
        outcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents,
        durationMs: result.meta.durationMs,
      }));

      return result;
    } catch {
      await failSession(payload.sessionId, "generating_directions").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong generating your directions. Give it another try.",
        },
        meta: { costCents: 0, durationMs: 0 },
      };
    }
  },
});
