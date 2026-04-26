import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import type { InterpretationOutput } from "@/server/services/interpretation";
import { runInterpretation } from "@/server/services/interpretation";
import { failSession } from "@/server/services/session";
import { MODEL_ROUTING } from "@/config/providers";

export const generationInterpretBrief = task({
  id: "generation-interpret-brief",
  run: async (
    payload: TaskPayload<{ briefText: string; assetType?: string }>
  ): Promise<TaskResult<InterpretationOutput>> => {
    const taskStart = Date.now();
    try {
      const result = await runInterpretation(
        payload.sessionId,
        payload.userId,
        payload.input.briefText,
        payload.input.assetType ?? "album_cover"
      );

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        provider: MODEL_ROUTING.interpretation.primary.provider,
        model: MODEL_ROUTING.interpretation.primary.model,
        stage: "interpret_brief",
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
        provider: MODEL_ROUTING.interpretation.primary.provider,
        model: MODEL_ROUTING.interpretation.primary.model,
        stage: "interpret_brief",
        finalOutcome: "failed",
        costCents: 0,
        durationMs,
      }));
      await failSession(payload.sessionId, "interpreting").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong interpreting your brief. Give it another try.",
        },
        meta: { costCents: 0, durationMs },
      };
    }
  },
});
