import "server-only";

import { db } from "@/server/db";
import { palettes } from "@/server/db/schema/palettes";
import { eq } from "drizzle-orm";

import {
  paletteRowSchema,
  type MoodAnchor,
  type PaletteRow,
  type PaletteStep,
} from "@/lib/schemas/palette";

function rowToPalette(row: typeof palettes.$inferSelect): PaletteRow {
  return paletteRowSchema.parse({
    id: row.id,
    userId: row.userId,
    status: row.status,
    step: row.step,
    moodAnchor: row.moodAnchor ?? null,
    dominant: row.dominant ?? null,
    accent: row.accent ?? null,
    neutrals: row.neutrals ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function getCurrentPalette(
  userId: string
): Promise<PaletteRow | null> {
  const [row] = await db
    .select()
    .from(palettes)
    .where(eq(palettes.userId, userId))
    .limit(1);

  return row ? rowToPalette(row) : null;
}

async function ensurePaletteRow(userId: string): Promise<PaletteRow> {
  const existing = await getCurrentPalette(userId);
  if (existing) return existing;

  const [row] = await db
    .insert(palettes)
    .values({ userId })
    .returning();

  return rowToPalette(row);
}

export async function startOrResumePalette(
  userId: string
): Promise<PaletteRow> {
  return ensurePaletteRow(userId);
}

export async function setMoodAnchor(
  userId: string,
  anchor: MoodAnchor
): Promise<PaletteRow> {
  await ensurePaletteRow(userId);
  const [row] = await db
    .update(palettes)
    .set({
      moodAnchor: anchor,
      step: "dominant",
      updatedAt: new Date(),
    })
    .where(eq(palettes.userId, userId))
    .returning();
  return rowToPalette(row);
}

export async function setDominant(
  userId: string,
  hex: string
): Promise<PaletteRow> {
  const [row] = await db
    .update(palettes)
    .set({ dominant: hex, step: "accent", updatedAt: new Date() })
    .where(eq(palettes.userId, userId))
    .returning();
  if (!row) throw new Error("Palette row not found");
  return rowToPalette(row);
}

export async function setAccent(
  userId: string,
  hex: string
): Promise<PaletteRow> {
  const [row] = await db
    .update(palettes)
    .set({ accent: hex, step: "neutrals", updatedAt: new Date() })
    .where(eq(palettes.userId, userId))
    .returning();
  if (!row) throw new Error("Palette row not found");
  return rowToPalette(row);
}

export async function setNeutrals(
  userId: string,
  hexes: [string, string, string]
): Promise<PaletteRow> {
  const [row] = await db
    .update(palettes)
    .set({ neutrals: hexes, step: "review", updatedAt: new Date() })
    .where(eq(palettes.userId, userId))
    .returning();
  if (!row) throw new Error("Palette row not found");
  return rowToPalette(row);
}

export async function lockPalette(userId: string): Promise<PaletteRow> {
  const current = await getCurrentPalette(userId);
  if (!current) throw new Error("No palette to lock");
  if (
    !current.moodAnchor ||
    !current.dominant ||
    !current.accent ||
    !current.neutrals
  ) {
    throw new Error("Palette is incomplete — finish all steps before locking");
  }

  const [row] = await db
    .update(palettes)
    .set({ status: "locked", step: "locked", updatedAt: new Date() })
    .where(eq(palettes.userId, userId))
    .returning();
  return rowToPalette(row);
}

export async function unlockForEdit(userId: string): Promise<PaletteRow> {
  const [row] = await db
    .update(palettes)
    .set({ status: "draft", step: "mood", updatedAt: new Date() })
    .where(eq(palettes.userId, userId))
    .returning();
  if (!row) throw new Error("Palette row not found");
  return rowToPalette(row);
}

export async function jumpToStep(
  userId: string,
  step: PaletteStep
): Promise<PaletteRow> {
  const [row] = await db
    .update(palettes)
    .set({ step, updatedAt: new Date() })
    .where(eq(palettes.userId, userId))
    .returning();
  if (!row) throw new Error("Palette row not found");
  return rowToPalette(row);
}
