import "server-only";

import { eq, inArray, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema/users";
import { sessions } from "@/server/db/schema/sessions";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { visualSpecs } from "@/server/db/schema/visual-specs";
import { deliverables } from "@/server/db/schema/deliverables";
import { providerMetrics } from "@/server/db/schema/provider-metrics";
import { referenceImages } from "@/server/db/schema/reference-images";
import { sessionReferenceSelections } from "@/server/db/schema/session-reference-selections";
import { sessionEvents } from "@/server/db/schema/session-events";
import { feedback } from "@/server/db/schema/feedback";
import { moodboards } from "@/server/db/schema/moodboards";
import { moodboardAnchors } from "@/server/db/schema/moodboard-anchors";
import { userReferences } from "@/server/db/schema/user-references";
import { payments } from "@/server/db/schema/payments";
import { artistMessages } from "@/server/db/schema/artist-messages";
import { deleteR2Object, deleteR2Prefix } from "@/server/services/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteAccount(userId: string): Promise<void> {
  const sessionRows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  const sessionIds = sessionRows.map((r) => r.id);

  const uploadedRefs = await db
    .select({ r2Key: userReferences.r2Key })
    .from(userReferences)
    .where(
      and(eq(userReferences.userId, userId), eq(userReferences.source, "upload"))
    );

  await Promise.allSettled([
    ...sessionIds.map((sid) =>
      deleteR2Prefix(`sessions/${sid}/`).catch((err) => {
        console.error(`[account-deletion] failed to clear R2 prefix for session ${sid}`, err);
      })
    ),
    ...uploadedRefs.map((ref) =>
      deleteR2Object(ref.r2Key).catch((err) => {
        console.error(`[account-deletion] failed to delete R2 object ${ref.r2Key}`, err);
      })
    ),
  ]);

  await db.transaction(async (tx) => {
    if (sessionIds.length > 0) {
      await tx.delete(feedback).where(inArray(feedback.sessionId, sessionIds));
      await tx
        .delete(generationAttempts)
        .where(inArray(generationAttempts.sessionId, sessionIds));
      await tx
        .delete(providerMetrics)
        .where(inArray(providerMetrics.sessionId, sessionIds));
      await tx
        .delete(referenceImages)
        .where(inArray(referenceImages.sessionId, sessionIds));
      await tx
        .delete(sessionReferenceSelections)
        .where(inArray(sessionReferenceSelections.sessionId, sessionIds));
      await tx
        .delete(sessionEvents)
        .where(inArray(sessionEvents.sessionId, sessionIds));
      await tx
        .delete(visualSpecs)
        .where(inArray(visualSpecs.sessionId, sessionIds));
      await tx
        .delete(deliverables)
        .where(inArray(deliverables.sessionId, sessionIds));
      await tx
        .delete(generationJobs)
        .where(inArray(generationJobs.sessionId, sessionIds));
    }

    await tx.delete(feedback).where(eq(feedback.userId, userId));
    await tx.delete(sessionEvents).where(eq(sessionEvents.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));

    const moodboardRows = await tx
      .select({ id: moodboards.id })
      .from(moodboards)
      .where(eq(moodboards.userId, userId));
    const moodboardIds = moodboardRows.map((m) => m.id);
    if (moodboardIds.length > 0) {
      await tx
        .delete(moodboardAnchors)
        .where(inArray(moodboardAnchors.moodboardId, moodboardIds));
      await tx.delete(moodboards).where(eq(moodboards.userId, userId));
    }

    await tx.delete(userReferences).where(eq(userReferences.userId, userId));
    await tx.delete(payments).where(eq(payments.userId, userId));
    await tx.delete(artistMessages).where(eq(artistMessages.userId, userId));
    await tx.execute(
      sql`delete from artist_identity_profiles where user_id = ${userId}`
    );
    await tx.delete(users).where(eq(users.id, userId));
  });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error(`[account-deletion] auth.admin.deleteUser failed for ${userId}`, error);
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }
}
