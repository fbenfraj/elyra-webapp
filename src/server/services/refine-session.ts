import "server-only";

import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { and, eq, sql } from "drizzle-orm";
type RefinementHistoryEntry = {
  round: number;
  pills: string[];
  text: string;
  timestamp: string;
};

export function composeRefinedBrief(
  originalBrief: string,
  selectedPills: string[],
  refinementText: string
): string {
  const parts: string[] = [`Original vision: ${originalBrief}`];

  if (selectedPills.length > 0) {
    parts.push(`Direction adjustments: ${selectedPills.join(", ")}`);
  }

  if (refinementText.length > 0) {
    parts.push(`Additional context: ${refinementText}`);
  }

  return parts.join("\n\n");
}

/**
 * Validates the session is in a refinable state, composes the refined brief,
 * and returns it WITHOUT modifying the session. The caller is responsible for
 * committing the session update only after the downstream pipeline succeeds,
 * so a failed refinement never destroys the last good session state.
 */
export async function refineSession(
  sessionId: string,
  userId: string,
  selectedPills: string[],
  refinementText: string
): Promise<
  | { ok: true; refinedBrief: string; sessionSnapshot: { briefText: string; refinementCount: number; refinementHistory: RefinementHistoryEntry[] } }
  | { ok: false; error: { code: string; message: string } }
> {
  // Validate session belongs to user and is in a selectable state
  const [session] = await db
    .select({
      id: sessions.id,
      briefText: sessions.briefText,
      status: sessions.status,
      refinementCount: sessions.refinementCount,
      refinementHistory: sessions.refinementHistory,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  if (!session) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Session not found" } };
  }

  if (session.status !== "complete" && session.status !== "direction_selected") {
    return {
      ok: false,
      error: { code: "INVALID_STATUS", message: "Session is not in a state that allows refinement" },
    };
  }

  // Compose the refined brief
  const refinedBrief = composeRefinedBrief(
    session.briefText,
    selectedPills,
    refinementText
  );

  // Build updated refinement history (returned to caller, not yet persisted)
  const currentHistory = (session.refinementHistory as RefinementHistoryEntry[] | null) ?? [];
  const newEntry: RefinementHistoryEntry = {
    round: session.refinementCount + 1,
    pills: selectedPills,
    text: refinementText,
    timestamp: new Date().toISOString(),
  };

  return {
    ok: true,
    refinedBrief,
    sessionSnapshot: {
      briefText: session.briefText,
      refinementCount: session.refinementCount,
      refinementHistory: [...currentHistory, newEntry],
    },
  };
}

/**
 * Commits the refinement to the session after the downstream pipeline has succeeded.
 * Called by the router only when interpretation returns a successful result.
 */
export async function commitRefinement(
  sessionId: string,
  refinedBrief: string,
  refinementCount: number,
  refinementHistory: RefinementHistoryEntry[]
): Promise<void> {
  await db
    .update(sessions)
    .set({
      briefText: refinedBrief,
      status: "pending",
      refinementCount: refinementCount + 1,
      refinementHistory,
      selectedDirectionId: null,
      selectedGenerationJobId: null,
      updatedAt: sql`now()`,
    })
    .where(eq(sessions.id, sessionId));
}
