import { z } from "zod/v4";

// --- Moodboard status ---

export const MOODBOARD_STATUS_VALUES = [
  "generating",
  "exploring",
  "refining",
  "complete",
  "failed",
] as const;

export type MoodboardStatus = (typeof MOODBOARD_STATUS_VALUES)[number];

// --- Exploration direction (stored in exploration_directions jsonb) ---

export const explorationDirectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  narrative: z.string().min(1),
  tags: z.array(z.string()).min(2).max(3),
  colorPalette: z.array(z.string()).length(5),
  textures: z.array(z.string()).min(1),
  environment: z.array(z.string()).min(1),
  lighting: z.string().min(1),
  imagePrompt: z.string().min(1),
  imageKey: z.string().min(1),
});

export type ExplorationDirection = z.infer<typeof explorationDirectionSchema>;

/** ExplorationDirection augmented with a signed hero image URL (added by the router). */
export type DirectionWithUrl = ExplorationDirection & { heroImageUrl: string };

// --- LLM direction output (before image generation, no imageKey yet) ---

export const directionLLMOutputSchema = z.object({
  directions: z
    .array(
      z.object({
        title: z.string().min(1),
        narrative: z.string().min(1),
        tags: z.array(z.string()).min(2).max(3),
        colorPalette: z.array(z.string()).length(5),
        textures: z.array(z.string()).min(1),
        environment: z.array(z.string()).min(1),
        lighting: z.string().min(1),
        imagePrompt: z.string().min(1),
      })
    )
    .length(6),
});

export type DirectionLLMOutput = z.infer<typeof directionLLMOutputSchema>;

// --- MoodboardSpec (finalized identity, stored in spec jsonb) ---

export const moodboardSpecSchema = z.object({
  // Core creative direction
  coreIdea: z.string().min(1),
  duality: z.string().min(1),
  narrative: z.string().min(1),

  // Visual world
  palette: z.array(z.string()).length(5),
  textures: z.array(z.string()).min(1),
  environment: z.array(z.string()).min(1),
  styling: z.array(z.string()).min(1),
  lighting: z.string().min(1),

  // Supporting metadata
  tags: z.array(z.string()).min(1),
  genreContext: z.string().min(1),
  culturalReferences: z.array(z.string()),
});

export type MoodboardSpec = z.infer<typeof moodboardSpecSchema>;

// --- Palette nudge ---

export const PALETTE_NUDGE_VALUES = [
  "darker",
  "lighter",
  "warmer",
  "cooler",
  "more_vibrant",
  "more_muted",
] as const;

export type PaletteNudge = (typeof PALETTE_NUDGE_VALUES)[number];

export const paletteNudgeSchema = z.enum(PALETTE_NUDGE_VALUES);
