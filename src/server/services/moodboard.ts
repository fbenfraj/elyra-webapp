// src/server/services/moodboard.ts
import "server-only";

import { db } from "@/server/db";
import { moodboards } from "@/server/db/schema/moodboards";
import { moodboardAnchors } from "@/server/db/schema/moodboard-anchors";
import { and, desc, eq, sql } from "drizzle-orm";
import { getSignedImageUrl } from "@/server/services/storage";
import type { ExplorationDirection, MoodboardSpec } from "@/lib/schemas/moodboard";
import { MOODBOARD_MAX_ANCHORS } from "@/config/moodboard";

export type MoodboardRow = {
  id: string;
  userId: string;
  status: string;
  spec: MoodboardSpec | null;
  explorationDirections: ExplorationDirection[] | null;
  likedDirectionIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type MoodboardAnchorWithUrl = {
  id: string;
  imageKey: string;
  sourceDirectionId: string;
  rank: number;
  imageUrl: string;
};

export async function createMoodboard(userId: string): Promise<{ id: string }> {
  const [row] = await db
    .insert(moodboards)
    .values({ userId })
    .returning({ id: moodboards.id });

  return row;
}

export async function getActiveMoodboard(
  userId: string
): Promise<(MoodboardRow & { anchors: MoodboardAnchorWithUrl[] }) | null> {
  const [row] = await db
    .select()
    .from(moodboards)
    .where(and(eq(moodboards.userId, userId), eq(moodboards.status, "complete")))
    .orderBy(desc(moodboards.updatedAt))
    .limit(1);

  if (!row) return null;

  const anchors = await getAnchors(row.id);

  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    spec: row.spec as MoodboardSpec | null,
    explorationDirections: row.explorationDirections as ExplorationDirection[] | null,
    likedDirectionIds: (row.likedDirectionIds as string[]) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    anchors,
  };
}

export async function getMoodboardById(
  id: string,
  userId: string
): Promise<MoodboardRow | null> {
  const [row] = await db
    .select()
    .from(moodboards)
    .where(and(eq(moodboards.id, id), eq(moodboards.userId, userId)));

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    spec: row.spec as MoodboardSpec | null,
    explorationDirections: row.explorationDirections as ExplorationDirection[] | null,
    likedDirectionIds: (row.likedDirectionIds as string[]) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function updateMoodboardDirections(
  id: string,
  directions: ExplorationDirection[]
): Promise<void> {
  await db
    .update(moodboards)
    .set({
      explorationDirections: directions as unknown as Record<string, unknown>,
      status: "exploring",
      updatedAt: sql`now()`,
    })
    .where(eq(moodboards.id, id));
}

export async function failMoodboard(id: string): Promise<void> {
  await db
    .update(moodboards)
    .set({ status: "failed", updatedAt: sql`now()` })
    .where(eq(moodboards.id, id));
}

export async function likeDirection(
  moodboardId: string,
  directionId: string
): Promise<string[]> {
  const [row] = await db
    .select({ likedDirectionIds: moodboards.likedDirectionIds })
    .from(moodboards)
    .where(eq(moodboards.id, moodboardId));

  if (!row) throw new Error(`Moodboard ${moodboardId} not found`);

  const current = (row.likedDirectionIds as string[]) ?? [];
  if (current.includes(directionId)) return current;

  const updated = [...current, directionId];
  await db
    .update(moodboards)
    .set({
      likedDirectionIds: updated as unknown as Record<string, unknown>,
      updatedAt: sql`now()`,
    })
    .where(eq(moodboards.id, moodboardId));

  return updated;
}

export async function unlikeDirection(
  moodboardId: string,
  directionId: string
): Promise<string[]> {
  const [row] = await db
    .select({ likedDirectionIds: moodboards.likedDirectionIds })
    .from(moodboards)
    .where(eq(moodboards.id, moodboardId));

  if (!row) throw new Error(`Moodboard ${moodboardId} not found`);

  const current = (row.likedDirectionIds as string[]) ?? [];
  const updated = current.filter((id) => id !== directionId);

  await db
    .update(moodboards)
    .set({
      likedDirectionIds: updated as unknown as Record<string, unknown>,
      updatedAt: sql`now()`,
    })
    .where(eq(moodboards.id, moodboardId));

  return updated;
}

export async function transitionToRefining(moodboardId: string): Promise<void> {
  await db
    .update(moodboards)
    .set({ status: "refining", updatedAt: sql`now()` })
    .where(eq(moodboards.id, moodboardId));
}

export async function revertToExploring(moodboardId: string): Promise<void> {
  await db
    .update(moodboards)
    .set({ status: "exploring", updatedAt: sql`now()` })
    .where(eq(moodboards.id, moodboardId));
}

export async function completeMoodboard(
  moodboardId: string,
  spec: MoodboardSpec,
  likedDirectionIds: string[],
  directions: ExplorationDirection[]
): Promise<void> {
  // Save spec and transition status
  await db
    .update(moodboards)
    .set({
      spec: spec as unknown as Record<string, unknown>,
      status: "complete",
      updatedAt: sql`now()`,
    })
    .where(eq(moodboards.id, moodboardId));

  // Create anchors from top-liked direction images (max 3, ranked by like order)
  const anchorDirectionIds = likedDirectionIds.slice(0, MOODBOARD_MAX_ANCHORS);
  const anchorValues = anchorDirectionIds
    .map((dirId, index) => {
      const direction = directions.find((d) => d.id === dirId);
      if (!direction) return null;
      return {
        moodboardId,
        imageKey: direction.imageKey,
        sourceDirectionId: dirId,
        rank: index + 1,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (anchorValues.length > 0) {
    await db.insert(moodboardAnchors).values(anchorValues);
  }
}

export async function getAnchors(
  moodboardId: string
): Promise<MoodboardAnchorWithUrl[]> {
  const rows = await db
    .select()
    .from(moodboardAnchors)
    .where(eq(moodboardAnchors.moodboardId, moodboardId))
    .orderBy(moodboardAnchors.rank);

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      imageKey: row.imageKey,
      sourceDirectionId: row.sourceDirectionId,
      rank: row.rank,
      imageUrl: await getSignedImageUrl(row.imageKey),
    }))
  );
}
