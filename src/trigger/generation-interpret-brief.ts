import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import type { InterpretationOutput } from "@/server/services/interpretation";
import { runInterpretation } from "@/server/services/interpretation";
import { failSession } from "@/server/services/session";

export const generationInterpretBrief = task({
  id: "generation-interpret-brief",
  run: async (
    payload: TaskPayload<{ briefText: string }>
  ): Promise<TaskResult<InterpretationOutput>> => {
    try {
      const result = await runInterpretation(
        payload.sessionId,
        payload.userId,
        payload.input.briefText
      );

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        stage: "interpret_brief",
        outcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents,
        durationMs: result.meta.durationMs,
      }));

      return result;
    } catch {
      await failSession(payload.sessionId, "interpreting").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong interpreting your brief. Give it another try.",
        },
        meta: { costCents: 0, durationMs: 0 },
      };
    }
  },
});
