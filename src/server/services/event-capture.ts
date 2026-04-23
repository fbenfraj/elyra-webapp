import "server-only";

import { db } from "@/server/db";
import { sessionEvents } from "@/server/db/schema/session-events";

export async function captureEvent(
  userId: string,
  sessionId: string,
  action: string,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    await db
      .insert(sessionEvents)
      .values({ userId, sessionId, action, payload: payload ?? null });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "event_capture_failed",
        userId,
        sessionId,
        action,
        error: String(error),
      })
    );
  }
}

export async function captureScreenTime(
  userId: string,
  sessionId: string,
  screen: string,
  durationMs: number
): Promise<void> {
  await captureEvent(userId, sessionId, "screen_exited", {
    screen,
    durationMs,
  });
}
