import "server-only";

import { db } from "@/server/db";
import { processedEvents } from "@/server/db/schema/processed-events";
import { eq } from "drizzle-orm";

export async function withIdempotency(
  eventKey: string,
  handlerName: string,
  handler: () => Promise<void>
): Promise<{ skipped: boolean }> {
  // Atomic claim: INSERT ... ON CONFLICT DO NOTHING ... RETURNING
  // Only one concurrent request can win this insert
  const [claimed] = await db
    .insert(processedEvents)
    .values({ eventKey, handlerName })
    .onConflictDoNothing({ target: processedEvents.eventKey })
    .returning({ id: processedEvents.id });

  if (!claimed) {
    return { skipped: true };
  }

  try {
    await handler();
  } catch (error) {
    // Handler failed — remove the claim so retries can re-execute
    await db.delete(processedEvents).where(eq(processedEvents.eventKey, eventKey));
    throw error;
  }

  return { skipped: false };
}
