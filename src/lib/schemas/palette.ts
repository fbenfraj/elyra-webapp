import { z } from "zod/v4";

export const PALETTE_STEPS = [
  "mood",
  "dominant",
  "accent",
  "neutrals",
  "review",
  "locked",
] as const;

export const paletteStepSchema = z.enum(PALETTE_STEPS);
export type PaletteStep = (typeof PALETTE_STEPS)[number];

export const PALETTE_STATUSES = ["draft", "locked"] as const;
export const paletteStatusSchema = z.enum(PALETTE_STATUSES);
export type PaletteStatus = (typeof PALETTE_STATUSES)[number];

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex like #1a2b3c");

export const moodAnchorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  temperature: z.enum(["warm", "cool", "neutral"]),
  brightness: z.enum(["dark", "mid", "light"]),
  saturation: z.enum(["muted", "balanced", "vibrant"]),
  previewHexes: z.array(hexColorSchema).length(3),
});

export type MoodAnchor = z.infer<typeof moodAnchorSchema>;

export const moodAnchorSuggestionsSchema = z.object({
  anchors: z.array(moodAnchorSchema).length(4),
});

export type MoodAnchorSuggestions = z.infer<typeof moodAnchorSuggestionsSchema>;

export const swatchSuggestionSchema = z.object({
  hex: hexColorSchema,
  label: z.string().min(1),
  rationale: z.string().min(1),
});

export type SwatchSuggestion = z.infer<typeof swatchSuggestionSchema>;

export const swatchSuggestionsSchema = z.object({
  swatches: z.array(swatchSuggestionSchema).length(6),
});

export type SwatchSuggestions = z.infer<typeof swatchSuggestionsSchema>;

export const neutralsSuggestionSchema = z.object({
  neutrals: z.array(hexColorSchema).length(3),
  rationale: z.string().min(1),
});

export type NeutralsSuggestion = z.infer<typeof neutralsSuggestionSchema>;

export const paletteRowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: paletteStatusSchema,
  step: paletteStepSchema,
  moodAnchor: moodAnchorSchema.nullable(),
  dominant: hexColorSchema.nullable(),
  accent: hexColorSchema.nullable(),
  neutrals: z.array(hexColorSchema).length(3).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PaletteRow = z.infer<typeof paletteRowSchema>;

export const setMoodAnchorInputSchema = z.object({
  anchor: moodAnchorSchema,
});

export const setHexInputSchema = z.object({
  hex: hexColorSchema,
});

export const setNeutralsInputSchema = z.object({
  hexes: z.array(hexColorSchema).length(3),
});

export const swapNeutralInputSchema = z.object({
  index: z.number().int().min(0).max(2),
});
