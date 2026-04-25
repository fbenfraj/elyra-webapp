import { z } from "zod/v4";

export const briefInputSchema = z.object({
  text: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Brief cannot be empty")),
  spotifyArtistUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        // Accept raw 22-char alphanumeric ID or full Spotify URL
        return (
          /^[a-zA-Z0-9]{22}$/.test(val) ||
          /open\.spotify\.com\/artist\/[a-zA-Z0-9]{22}/.test(val)
        );
      },
      { message: "Invalid Spotify artist URL or ID" }
    ),
});

export type BriefInput = z.infer<typeof briefInputSchema>;
