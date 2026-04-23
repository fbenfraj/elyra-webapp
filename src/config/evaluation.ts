/** Evaluation thresholds and rubric weights for VLM image evaluation (Story 4.2). */

export const MIN_PASS_SCORE = 0.7;
export const MAX_EVAL_RETRIES = 3;

export const RUBRIC_WEIGHTS = {
  composition: 0.25,
  colorAccuracy: 0.2,
  moodAlignment: 0.2,
  textAccuracy: 0.2,
  brandConsistency: 0.15,
} as const;

// Genre-specific rubric weight overrides (Story 7.3)
export const GENRE_RUBRIC_OVERRIDES: Record<string, Partial<typeof RUBRIC_WEIGHTS>> = {
  // Example overrides — uncomment/add as taste calibration reveals patterns
  // "trap": { moodAlignment: 0.30, composition: 0.15 },
  // "ambient": { moodAlignment: 0.30, colorAccuracy: 0.25, composition: 0.20, textAccuracy: 0.10, brandConsistency: 0.15 },
};

export function getRubricWeights(genre?: string): typeof RUBRIC_WEIGHTS {
  if (!genre) return RUBRIC_WEIGHTS;
  const overrides = GENRE_RUBRIC_OVERRIDES[genre.toLowerCase()];
  if (!overrides) return RUBRIC_WEIGHTS;
  return { ...RUBRIC_WEIGHTS, ...overrides } as typeof RUBRIC_WEIGHTS;
}
