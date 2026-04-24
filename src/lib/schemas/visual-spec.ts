import { z } from "zod/v4";

export const visualSpecSchema = z.object({
  palette: z.array(z.string()).min(1),
  mood: z.string().min(1),
  composition: z.string().min(1),
  style: z.string().min(1),
  culturalReferences: z.array(z.string()),
  genreContext: z.string().min(1),
  continuityCues: z.string().nullable(),
});

export type VisualSpec = z.infer<typeof visualSpecSchema>;

export const interpretationResponseSchema = z.object({
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "How confident you are that the brief has enough specificity for differentiated creative directions. 0 = completely vague, 1 = very specific."
    ),
  followUpQuestions: z
    .array(z.string())
    .max(2)
    .describe(
      "If confidence < 0.7, provide 1-2 conversational nudge questions to help the artist clarify. Questions should feel like a creative director asking, not a search engine. Examples: 'More gritty or more polished?', 'Any artist or album cover that captures this feeling?'"
    ),
  spec: visualSpecSchema
    .nullable()
    .describe(
      "The structured visual specification. Provide when confidence >= 0.7, otherwise set to null."
    ),
});

export type InterpretationResponse = z.infer<
  typeof interpretationResponseSchema
>;
