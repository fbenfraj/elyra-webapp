import "server-only";

import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import { eq } from "drizzle-orm";
import type { VisualSpec } from "@/lib/schemas/visual-spec";

export async function storeVisualSpec(sessionId: string, specData: VisualSpec) {
  // Verify parent session exists before creating the child visual spec to
  // prevent orphaned rows if the session was deleted mid-pipeline.
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session) {
    throw new Error(`Cannot create visual spec: session "${sessionId}" not found`);
  }

  const [row] = await db
    .insert(visualSpecs)
    .values({ sessionId, specData })
    .returning({ id: visualSpecs.id });

  return row;
}
