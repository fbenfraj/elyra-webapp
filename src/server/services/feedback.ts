import "server-only";

import { db } from "@/server/db";
import { feedback } from "@/server/db/schema/feedback";
import { eq, and, desc } from "drizzle-orm";

export async function toggleLike(
  userId: string,
  sessionId: string,
  generationAttemptId: string
): Promise<{ liked: boolean }> {
  // Get current state (latest action for this user+attempt)
  const [latest] = await db
    .select({ action: feedback.action })
    .from(feedback)
    .where(
      and(
        eq(feedback.userId, userId),
        eq(feedback.generationAttemptId, generationAttemptId)
      )
    )
    .orderBy(desc(feedback.createdAt))
    .limit(1);

  const newAction = latest?.action === "like" ? "unlike" : "like";

  await db.insert(feedback).values({
    userId,
    sessionId,
    generationAttemptId,
    action: newAction,
  });

  return { liked: newAction === "like" };
}

export async function getLikedAttemptIds(
  userId: string,
  sessionId: string
): Promise<string[]> {
  // Get all feedback for this user+session
  const rows = await db
    .select({
      generationAttemptId: feedback.generationAttemptId,
      action: feedback.action,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(
      and(eq(feedback.userId, userId), eq(feedback.sessionId, sessionId))
    )
    .orderBy(desc(feedback.createdAt));

  // Derive current state: latest action per attempt
  const latestByAttempt = new Map<string, string>();
  for (const row of rows) {
    if (!latestByAttempt.has(row.generationAttemptId)) {
      latestByAttempt.set(row.generationAttemptId, row.action);
    }
  }

  return Array.from(latestByAttempt.entries())
    .filter(([, action]) => action === "like")
    .map(([attemptId]) => attemptId);
}
