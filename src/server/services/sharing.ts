import "server-only";

import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { eq, sql } from "drizzle-orm";

type StoredDirection = {
  id: string;
  heroImageKey: string;
  moodLabel: string;
  tags: string[];
  supportingImageKeys: string[];
  colorPalette: string[];
  description: string;
};

type StoredDirectionData = {
  directions: StoredDirection[];
};

export type SharedDirectionData = {
  moodLabel: string;
  description: string;
  palette: string[];
  tags: string[];
};

/**
 * Creates a share link for a session's direction summary.
 * Generates a nanoid share ID if one doesn't exist yet.
 */
export async function createShareLinkForSession(
  sessionId: string,
  userId: string
): Promise<{ shareUrl: string; shareId: string }> {
  // Verify session ownership
  const [session] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      shareId: sessions.shareId,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.userId !== userId) {
    throw new Error("Session not found");
  }

  // Return existing share link if already created
  if (session.shareId) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3847";
    return {
      shareUrl: `${baseUrl}/direction/${session.shareId}`,
      shareId: session.shareId,
    };
  }

  // Generate new share ID
  const shareId = nanoid(12);

  await db
    .update(sessions)
    .set({ shareId, updatedAt: sql`now()` })
    .where(eq(sessions.id, sessionId));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3847";
  return {
    shareUrl: `${baseUrl}/direction/${shareId}`,
    shareId,
  };
}

/**
 * Loads direction data for a shared session (public, no auth needed).
 */
export async function getSharedDirection(
  shareId: string
): Promise<SharedDirectionData | null> {
  const [session] = await db
    .select({
      id: sessions.id,
      selectedDirectionId: sessions.selectedDirectionId,
      selectedGenerationJobId: sessions.selectedGenerationJobId,
    })
    .from(sessions)
    .where(eq(sessions.shareId, shareId));

  if (!session || !session.selectedGenerationJobId || !session.selectedDirectionId) {
    return null;
  }

  const [job] = await db
    .select({ directionData: generationJobs.directionData })
    .from(generationJobs)
    .where(eq(generationJobs.id, session.selectedGenerationJobId));

  if (!job) {
    return null;
  }

  const directionData = job.directionData as StoredDirectionData;
  const direction = directionData.directions.find(
    (d) => d.id === session.selectedDirectionId
  );

  if (!direction) {
    return null;
  }

  return {
    moodLabel: direction.moodLabel,
    description: direction.description,
    palette: direction.colorPalette.slice(0, 5),
    tags: direction.tags,
  };
}
