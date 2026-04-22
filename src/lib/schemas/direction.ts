import { z } from "zod/v4";

export const directionSchema = z.object({
  id: z.string(),
  heroImageUrl: z.string(),
  moodLabel: z.string(),
  tags: z.array(z.string()).min(2).max(3),
  supportingImageUrls: z.array(z.string()),
  colorPalette: z.array(z.string()).length(5),
  description: z.string(),
});

export type Direction = z.infer<typeof directionSchema>;

export const directionDataSchema = z.object({
  directions: z.array(directionSchema).min(2).max(3),
});

export type DirectionData = z.infer<typeof directionDataSchema>;
