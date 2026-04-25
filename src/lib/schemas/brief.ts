import { z } from "zod/v4";

export const ASSET_TYPE_VALUES = [
  "release_artwork",
  "instagram_post",
  "instagram_story",
  "announcement",
  "artist_portrait",
] as const;

export const briefInputSchema = z.object({
  assetType: z.enum(ASSET_TYPE_VALUES),
  text: z
    .string()
    .transform((s) => s.trim())
    .optional(),
});

export type BriefInput = z.infer<typeof briefInputSchema>;
