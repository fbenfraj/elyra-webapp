import "server-only";

import { db } from "@/server/db";
import { moodboards } from "@/server/db/schema/moodboards";
import { moodboardAnchors } from "@/server/db/schema/moodboard-anchors";
import { and, desc, eq, sql } from "drizzle-orm";
import { getSignedImageUrl } from "@/server/services/storage";
import type { ExplorationDirection, MoodboardSpec, MoodboardStatus } from "@/lib/schemas/moodboard";
import { MOODBOARD_MAX_ANCHORS } from "@/config/moodboard";

export type MoodboardRow = {
  id: string;
  userId: string;
  status: MoodboardStatus;
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
): Promise<(Omit<MoodboardRow, "explorationDirections"> & { anchors: MoodboardAnchorWithUrl[] }) | null> {
  const [row] = await db
    .select({
      id: moodboards.id,
      userId: moodboards.userId,
      status: moodboards.status,
      spec: moodboards.spec,
      likedDirectionIds: moodboards.likedDirectionIds,
      createdAt: moodboards.createdAt,
      updatedAt: moodboards.updatedAt,
    })
    .from(moodboards)
    .where(and(eq(moodboards.userId, userId), eq(moodboards.status, "complete")))
    .orderBy(desc(moodboards.updatedAt))
    .limit(1);

  if (!row) return null;

  const anchors = await getAnchors(row.id);

  return {
    id: row.id,
    userId: row.userId,
    status: row.status as MoodboardStatus,
    spec: row.spec as MoodboardSpec | null,
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
    status: row.status as MoodboardStatus,
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

async function updateLikedDirectionIds(
  moodboardId: string,
  current: string[],
  updater: (ids: string[]) => string[]
): Promise<string[]> {
  const updated = updater(current);
  if (updated === current) return current;

  await db
    .update(moodboards)
    .set({
      likedDirectionIds: updated as unknown as Record<string, unknown>,
      updatedAt: sql`now()`,
    })
    .where(eq(moodboards.id, moodboardId));

  return updated;
}

export async function likeDirection(
  moodboardId: string,
  directionId: string,
  current: string[]
): Promise<string[]> {
  return updateLikedDirectionIds(moodboardId, current, (ids) =>
    ids.includes(directionId) ? ids : [...ids, directionId]
  );
}

export async function unlikeDirection(
  moodboardId: string,
  directionId: string,
  current: string[]
): Promise<string[]> {
  return updateLikedDirectionIds(moodboardId, current, (ids) =>
    ids.filter((id) => id !== directionId)
  );
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

  await db.transaction(async (tx) => {
    await tx
      .update(moodboards)
      .set({
        spec: spec as unknown as Record<string, unknown>,
        status: "complete",
        updatedAt: sql`now()`,
      })
      .where(eq(moodboards.id, moodboardId));

    if (anchorValues.length > 0) {
      await tx.insert(moodboardAnchors).values(anchorValues);
    }
  });
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
