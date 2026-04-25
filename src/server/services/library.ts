import "server-only";

import { db } from "@/server/db";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { sessions } from "@/server/db/schema/sessions";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { getSignedImageUrl, deleteR2Object } from "@/server/services/storage";

const PAGE_SIZE = 24;

export type LibraryFilter = {
  sessionId?: string;
  favoritedOnly?: boolean;
  since?: "7d" | "30d" | "all";
  page?: number;
};

export type LibraryImage = {
  id: string;
  imageUrl: string;
  sessionId: string;
  sessionBrief: string;
  favorited: boolean;
  createdAt: Date;
};

export async function listUserImages(
  userId: string,
  filters: LibraryFilter = {}
): Promise<{ images: LibraryImage[]; total: number }> {
  const page = filters.page ?? 1;
  const offset = (page - 1) * PAGE_SIZE;

  // Build WHERE conditions
  const conditions = [eq(sessions.userId, userId)];

  if (filters.sessionId) {
    conditions.push(eq(generationAttempts.sessionId, filters.sessionId));
  }

  if (filters.favoritedOnly) {
    conditions.push(eq(generationAttempts.favorited, true));
  }

  if (filters.since && filters.since !== "all") {
    const days = filters.since === "7d" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    conditions.push(gte(generationAttempts.createdAt, cutoff));
  }

  const where = and(...conditions);

  // Count total
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(generationAttempts)
    .innerJoin(sessions, eq(sessions.id, generationAttempts.sessionId))
    .where(where);

  const total = Number(countResult?.count ?? 0);

  // Fetch page
  const rows = await db
    .select({
      id: generationAttempts.id,
      imageKey: generationAttempts.imageKey,
      sessionId: generationAttempts.sessionId,
      sessionBrief: sessions.briefText,
      favorited: generationAttempts.favorited,
      createdAt: generationAttempts.createdAt,
    })
    .from(generationAttempts)
    .innerJoin(sessions, eq(sessions.id, generationAttempts.sessionId))
    .where(where)
    .orderBy(desc(generationAttempts.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // Sign URLs
  const images = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      imageUrl: await getSignedImageUrl(row.imageKey),
      sessionId: row.sessionId,
      sessionBrief: row.sessionBrief,
      favorited: row.favorited,
      createdAt: row.createdAt,
    }))
  );

  return { images, total };
}

export async function toggleFavorite(
  userId: string,
  attemptId: string
): Promise<{ favorited: boolean }> {
  // Verify ownership via session join
  const [attempt] = await db
    .select({
      id: generationAttempts.id,
      favorited: generationAttempts.favorited,
    })
    .from(generationAttempts)
    .innerJoin(sessions, eq(sessions.id, generationAttempts.sessionId))
    .where(
      and(
        eq(generationAttempts.id, attemptId),
        eq(sessions.userId, userId)
      )
    );

  if (!attempt) {
    throw new Error("Image not found");
  }

  const newValue = !attempt.favorited;

  await db
    .update(generationAttempts)
    .set({ favorited: newValue })
    .where(eq(generationAttempts.id, attemptId));

  return { favorited: newValue };
}

export async function deleteImage(
  userId: string,
  attemptId: string
): Promise<void> {
  // Verify ownership via session join
  const [attempt] = await db
    .select({
      id: generationAttempts.id,
      imageKey: generationAttempts.imageKey,
    })
    .from(generationAttempts)
    .innerJoin(sessions, eq(sessions.id, generationAttempts.sessionId))
    .where(
      and(
        eq(generationAttempts.id, attemptId),
        eq(sessions.userId, userId)
      )
    );

  if (!attempt) {
    throw new Error("Image not found");
  }

  // Delete from R2, then from DB
  await deleteR2Object(attempt.imageKey);
  await db
    .delete(generationAttempts)
    .where(eq(generationAttempts.id, attemptId));
}

export async function getImageDownloadUrl(
  userId: string,
  attemptId: string
): Promise<string> {
  const [attempt] = await db
    .select({
      id: generationAttempts.id,
      imageKey: generationAttempts.imageKey,
    })
    .from(generationAttempts)
    .innerJoin(sessions, eq(sessions.id, generationAttempts.sessionId))
    .where(
      and(
        eq(generationAttempts.id, attemptId),
        eq(sessions.userId, userId)
      )
    );

  if (!attempt) {
    throw new Error("Image not found");
  }

  return getSignedImageUrl(attempt.imageKey);
}
