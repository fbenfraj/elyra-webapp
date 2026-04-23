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

export const webhookProcessFal = task({
  id: "webhook-process-fal",
  run: async (
    payload: FalWebhookPayload
  ): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> => {
    const { skipped } = await withIdempotency(
      `fal-webhook:${payload.requestId}`,
      "webhook-process-fal",
      async () => {
        if (payload.status === "ERROR") {
          console.error(
            JSON.stringify({
              event: "fal_webhook_error",
              requestId: payload.requestId,
              sessionId: payload.sessionId,
              error: payload.error,
            })
          );

          await failSession(payload.sessionId, "generating_images");
          return;
        }

        const images = payload.payload?.images;
        if (!images || images.length === 0) {
          console.warn(
            JSON.stringify({
              event: "fal_webhook_no_images",
              requestId: payload.requestId,
              sessionId: payload.sessionId,
            })
          );

          await failSession(payload.sessionId, "generating_images");
          return;
        }

        console.info(
          JSON.stringify({
            event: "fal_webhook_processed",
            requestId: payload.requestId,
            sessionId: payload.sessionId,
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
