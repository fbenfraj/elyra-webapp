import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import { assemblePackage } from "@/server/services/packaging";
import { failSession } from "@/server/services/session";

// Packaging is a local operation — no external provider involved
const PACKAGING_PROVIDER = "internal";
const PACKAGING_MODEL = "zip-assembler";

export const generationAssemblePackage = task({
  id: "generation-assemble-package",
  run: async (
    payload: TaskPayload<Record<string, never>>
  ): Promise<
    TaskResult<{ deliverableCount: number; totalSizeBytes: number }>
  > => {
    const taskStart = Date.now();
    try {
      const result = await assemblePackage(payload.sessionId, payload.userId);

      console.info(JSON.stringify({
        event: "pipeline_stage_complete",
        sessionId: payload.sessionId,
        userId: payload.userId,
        provider: PACKAGING_PROVIDER,
        model: PACKAGING_MODEL,
        stage: "assemble_package",
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
        provider: PACKAGING_PROVIDER,
        model: PACKAGING_MODEL,
        stage: "assemble_package",
        finalOutcome: "failed",
        costCents: 0,
        durationMs,
      }));
      await failSession(payload.sessionId, "packaging").catch(() => {});
      return {
        ok: false,
        error: {
          code: "TASK_FAILED",
          message: "Something went wrong assembling your package. Give it another try.",
        },
        meta: { costCents: 0, durationMs },
      };
    }
  },
});
