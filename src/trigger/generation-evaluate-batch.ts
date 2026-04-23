import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import { evaluateBatch, getBatchCount } from "@/server/services/evaluation";
import { updateSessionStatus, failSession } from "@/server/services/session";
import { MAX_EVAL_RETRIES } from "@/config/evaluation";
import { generationRefinePrompt } from "@/trigger/generation-refine-prompt";

export const generationEvaluateBatch = task({
  id: "generation-evaluate-batch",
  run: async (
    payload: TaskPayload<Record<string, never>>
  ): Promise<
    TaskResult<{
      evaluatedCount: number;
      passingCount: number;
      totalCostCents: number;
    }>
  > => {
    try {
      const result = await evaluateBatch(payload.sessionId, payload.userId);

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        stage: "evaluate_batch",
        outcome: result.ok ? "success" : "failure",
        costCents: result.meta.costCents,
        durationMs: result.meta.durationMs,
      }));

      if (!result.ok) {
        return result;
      }

      const { passingCount } = result.output!;

      if (passingCount > 0) {
        // Images pass threshold — move to selecting status
        await updateSessionStatus(payload.sessionId, "selecting");
      } else {
        // No images pass — check retry count
        const batchCount = await getBatchCount(payload.sessionId);

        if (batchCount >= MAX_EVAL_RETRIES) {
          // Max retries exhausted — graceful degradation, use best-scoring
          await updateSessionStatus(payload.sessionId, "selecting");
        } else {
          // Retries remaining — trigger prompt refinement
          await generationRefinePrompt.trigger({
            sessionId: payload.sessionId,
            userId: payload.userId,
            input: {},
          });
        }
      }

      return result;
    } catch {
      await failSession(payload.sessionId, "evaluating").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong evaluating your images. Give it another try.",
        },
        meta: { costCents: 0, durationMs: 0 },
      };
    }
  },
});
