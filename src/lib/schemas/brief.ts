import { z } from "zod/v4";

export const ASSET_TYPE_VALUES = [
  "release_artwork",
  "album_cover",
  "single_cover",
  "ep_cover",
  "instagram_post",
  "instagram_story",
  "announcement",
  "artist_portrait",
  "press_photo",
] as const;

export const briefInputSchema = z.object({
  assetType: z.enum(ASSET_TYPE_VALUES),
  text: z
    .string()
    .transform((s) => s.trim())
    .optional(),
  referenceIds: z.array(z.string()).max(5).optional(),
});

export type BriefInput = z.infer<typeof briefInputSchema>;
