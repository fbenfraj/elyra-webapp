import { task } from "@trigger.dev/sdk/v3";
import { withIdempotency } from "@/server/services/idempotency";
import { failSession } from "@/server/services/session";

type FalWebhookPayload = {
  requestId: string;
  sessionId: string;
  userId: string;
  status: "OK" | "ERROR";
  payload?: {
    images?: Array<{ url: string; content_type: string }>;
  };
  error?: string;
};

const FAL_PROVIDER = "fal";
const FAL_MODEL = "fal-ai/flux-pro/v2";

export const webhookProcessFal = task({
  id: "webhook-process-fal",
  run: async (
    payload: FalWebhookPayload
  ): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> => {
    const taskStart = Date.now();
    const { skipped } = await withIdempotency(
      `fal-webhook:${payload.requestId}`,
      "webhook-process-fal",
      async () => {
        if (payload.status === "ERROR") {
          console.error(
            JSON.stringify({
              event: "pipeline_stage_complete",
              sessionId: payload.sessionId,
              userId: payload.userId,
              provider: FAL_PROVIDER,
              model: FAL_MODEL,
              stage: "webhook_process_fal",
              finalOutcome: "failed",
              costCents: 0,
              durationMs: Date.now() - taskStart,
              requestId: payload.requestId,
              error: payload.error,
            })
          );

          await failSession(payload.sessionId, "generating_images");
          return;
        }

        const images = payload.payload?.images;
        if (!images || images.length === 0) {
          console.error(
            JSON.stringify({
              event: "pipeline_stage_complete",
              sessionId: payload.sessionId,
              userId: payload.userId,
              provider: FAL_PROVIDER,
              model: FAL_MODEL,
              stage: "webhook_process_fal",
              finalOutcome: "failed",
              costCents: 0,
              durationMs: Date.now() - taskStart,
              requestId: payload.requestId,
              reason: "no_images_returned",
            })
          );

          await failSession(payload.sessionId, "generating_images");
          return;
        }

        console.info(
          JSON.stringify({
            event: "pipeline_stage_complete",
            sessionId: payload.sessionId,
            userId: payload.userId,
            provider: FAL_PROVIDER,
            model: FAL_MODEL,
            stage: "webhook_process_fal",
            finalOutcome: "success",
            costCents: 0,
            durationMs: Date.now() - taskStart,
            requestId: payload.requestId,
            imageCount: images.length,
          })
        );
      }
    );

    if (skipped) {
      return { ok: true, skipped: true, reason: "Already processed" };
    }

    return { ok: true };
  },
});
