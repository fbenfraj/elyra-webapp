// src/server/services/moodboard-refinement.ts
import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { getMoodboardById } from "@/server/services/moodboard";
import { getUserSettings } from "@/server/services/user";
import { getCachedArtist } from "@/server/services/spotify-sync";
import { moodboardSpecSchema } from "@/lib/schemas/moodboard";
import type { MoodboardSpec, PaletteNudge } from "@/lib/schemas/moodboard";
import { MOODBOARD_REFINEMENT_MODEL, MOODBOARD_REFINEMENT_SYSTEM_PROMPT } from "@/config/moodboard";

export async function computeRefinementDefaults(
  moodboardId: string,
  userId: string
): Promise<{ spec: MoodboardSpec; costCents: number }> {
  // Step 1: Load moodboard with liked directions
  const moodboard = await getMoodboardById(moodboardId, userId);
  if (!moodboard) throw new Error(`Moodboard ${moodboardId} not found`);
  if (!moodboard.explorationDirections) throw new Error("No exploration directions found");

  const directions = moodboard.explorationDirections;
  const likedIds = moodboard.likedDirectionIds;
  const likedDirections = directions.filter((d) => likedIds.includes(d.id));

  if (likedDirections.length === 0) {
    throw new Error("No liked directions — cannot compute refinement defaults");
  }

  // Step 2: Load Spotify artist context
  const settings = await getUserSettings(userId);
  let artistContext = "";
  if (settings.artistId) {
    try {
      const artist = await getCachedArtist(settings.artistId);
      if (artist) {
        const parts: string[] = [];
        parts.push(`Artist: ${artist.name}`);
        if (artist.genres?.length) parts.push(`Genres: ${artist.genres.join(", ")}`);
        if (artist.audioProfile) {
          const ap = artist.audioProfile;
          parts.push(`Audio: energy=${ap.energy.toFixed(2)}, valence=${ap.valence.toFixed(2)}, acousticness=${ap.acousticness.toFixed(2)}, tempo=${ap.tempo.toFixed(0)}BPM`);
        }
        artistContext = parts.join("\n");
      }
    } catch {
      // Continue without artist context
    }
  }

  // Step 3: Build synthesis prompt
  const likedSummary = likedDirections
    .map(
      (d, i) =>
        `Direction ${i + 1}: "${d.title}"\nNarrative: ${d.narrative}\nTags: ${d.tags.join(", ")}\nPalette: ${d.colorPalette.join(", ")}\nTextures: ${d.textures.join(", ")}\nEnvironment: ${d.environment.join(", ")}\nLighting: ${d.lighting}`
    )
    .join("\n\n");

  const prompt = `LIKED DIRECTIONS:\n${likedSummary}\n\nARTIST CONTEXT:\n${artistContext || "No Spotify data available"}`;

  // Step 4: LLM synthesis
  const { object: spec, usage } = await generateObject({
    model: openai(MOODBOARD_REFINEMENT_MODEL),
    schema: moodboardSpecSchema,
    system: MOODBOARD_REFINEMENT_SYSTEM_PROMPT,
    prompt,
  });

  // Track cost (GPT-4.1: $2/1M input, $8/1M output)
  const inputCost = ((usage.inputTokens ?? 0) / 1_000_000) * 200;
  const outputCost = ((usage.outputTokens ?? 0) / 1_000_000) * 800;
  const costCents = Math.round((inputCost + outputCost) * 100) / 100;

  // Step 5: Apply audio profile nudges to palette
  if (settings.artistId) {
    try {
      const artist = await getCachedArtist(settings.artistId);
      if (artist?.audioProfile) {
        const ap = artist.audioProfile;
        // Low valence → darker
        if (ap.valence < 0.4) {
          spec.palette = applyPaletteNudge(spec.palette, "darker");
        }
        // High energy → more saturated
        if (ap.energy > 0.7) {
          spec.palette = applyPaletteNudge(spec.palette, "more_vibrant");
        }
        // High acousticness → warmer/more muted
        if (ap.acousticness > 0.6) {
          spec.palette = applyPaletteNudge(spec.palette, "warmer");
        }
      }
    } catch {
      // Continue with un-nudged palette
    }
  }

  console.info(JSON.stringify({
    event: "moodboard_refinement_complete",
    moodboardId,
    userId,
    costCents,
  }));

  return { spec, costCents };
}

export function applyPaletteNudge(
  palette: string[],
  nudge: PaletteNudge
): string[] {
  return palette.map((hex) => {
    const { h, s, l } = hexToHsl(hex);

    switch (nudge) {
      case "darker":
        return hslToHex(h, s, Math.max(0, l - 10));
      case "lighter":
        return hslToHex(h, s, Math.min(100, l + 10));
      case "warmer":
        return hslToHex(shiftHueToward(h, 30), s, l);
      case "cooler":
        return hslToHex(shiftHueToward(h, 210), s, l);
      case "more_vibrant":
        return hslToHex(h, Math.min(100, s + 15), l);
      case "more_muted":
        return hslToHex(h, Math.max(0, s - 15), l);
    }
  });
}

// --- Color utility helpers ---

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = ((max + min) / 2) * 100;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = (l > 50 ? d / (2 - max - min) : d / (max + min)) * 100;

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;

  return { h: Math.round(h), s: Math.round(s), l: Math.round(l) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function shiftHueToward(currentHue: number, targetHue: number): number {
  const diff = targetHue - currentHue;
  const wrapped = ((diff + 180) % 360) - 180;
  const shift = Math.sign(wrapped) * Math.min(Math.abs(wrapped), 15);
  return (currentHue + shift + 360) % 360;
}
