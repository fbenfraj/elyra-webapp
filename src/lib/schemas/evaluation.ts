import { z } from "zod/v4";

/** Per-criterion scores, each 0-1 */
export const evaluationRubricSchema = z.object({
  composition: z.number().min(0).max(1),
  colorAccuracy: z.number().min(0).max(1),
  moodAlignment: z.number().min(0).max(1),
  textAccuracy: z.number().min(0).max(1),
  brandConsistency: z.number().min(0).max(1),
});

export type EvaluationRubric = z.infer<typeof evaluationRubricSchema>;

/** Full evaluation result returned by VLM */
export const evaluationResultSchema = z.object({
  scores: evaluationRubricSchema,
  overallScore: z.number().min(0).max(1),
  feedback: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
