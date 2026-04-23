import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import { assemblePackage } from "@/server/services/packaging";
import { failSession } from "@/server/services/session";

export const generationAssemblePackage = task({
  id: "generation-assemble-package",
  run: async (
    payload: TaskPayload<Record<string, never>>
  ): Promise<
    TaskResult<{ deliverableCount: number; totalSizeBytes: number }>
  > => {
    try {
      const result = await assemblePackage(payload.sessionId, payload.userId);

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        stage: "assemble_package",
        outcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents,
        durationMs: result.meta.durationMs,
      }));

      return result;
    } catch {
      await failSession(payload.sessionId, "packaging").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong assembling your package. Give it another try.",
        },
        meta: { costCents: 0, durationMs: 0 },
      };
    }
  },
});
