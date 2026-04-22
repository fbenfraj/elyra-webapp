import "server-only";

import { db } from "@/server/db";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import type { VisualSpec } from "@/lib/schemas/visual-spec";

export async function storeVisualSpec(sessionId: string, specData: VisualSpec) {
  const [row] = await db
    .insert(visualSpecs)
    .values({ sessionId, specData })
    .returning({ id: visualSpecs.id });

  return row;
}
