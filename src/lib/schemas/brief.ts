import { z } from "zod/v4";

export const briefInputSchema = z.object({
  text: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Brief cannot be empty")),
});

export type BriefInput = z.infer<typeof briefInputSchema>;
