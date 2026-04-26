import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import { generateMoodboardDirections } from "@/server/services/moodboard-directions";

export const moodboardGenerateDirections = task({
  id: "moodboard-generate-directions",
  retry: {
    maxAttempts: 2,
    factor: 1.8,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
  },
  run: async (
    payload: TaskPayload<{ moodboardId: string }>
  ): Promise<TaskResult<null>> => {
    const taskStart = Date.now();

    try {
      const { costCents, durationMs } = await generateMoodboardDirections(
        payload.userId,
        payload.input.moodboardId
      );

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.input.moodboardId,
        userId: payload.userId,
        stage: "moodboard_generate_directions",
        finalOutcome: "success",
        costCents,
        durationMs,
      }));

      return {
        ok: true,
        output: null,
        meta: { costCents, durationMs },
      };
    } catch (err) {
      console.error("[trigger:moodboard-generate-directions] failed:", err);
      const durationMs = Date.now() - taskStart;

      return {
        ok: false,
        error: {
          code: "MOODBOARD_DIRECTION_FAILED",
          message: "Something went wrong generating your visual directions. Give it another try.",
        },
        meta: { costCents: 0, durationMs },
      };
    }
  },
});
