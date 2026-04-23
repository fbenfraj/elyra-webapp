/** Client-side timeout thresholds for generation phases (milliseconds). */

/** Narrative shifts to "Taking a bit longer than usual..." */
export const TIMEOUT_DELAYED_MS = 120_000;

/** Retry option appears for direction generation */
export const TIMEOUT_DIRECTION_EXTENDED_MS = 180_000;

/** Retry option appears for image generation */
export const TIMEOUT_IMAGE_EXTENDED_MS = 180_000;

/** Retry option appears for packaging */
export const TIMEOUT_PACKAGE_EXTENDED_MS = 240_000;

/**
 * Polling interval for generation status (ms).
 * Used by client-side polling logic. Exported as a named constant so it can be
 * referenced in polling hooks without magic numbers.
 */
export const STATUS_POLL_INTERVAL_MS = 3_000;

export type TimeoutLevel = "normal" | "delayed" | "extended";

export type GenerationPhase =
  | "interpreting"
  | "generating_directions"
  | "generating_images"
  | "evaluating"
  | "packaging";

/** Map phases to their extended timeout threshold */
export const EXTENDED_TIMEOUT_BY_PHASE: Record<GenerationPhase, number> = {
  interpreting: TIMEOUT_DIRECTION_EXTENDED_MS,
  generating_directions: TIMEOUT_DIRECTION_EXTENDED_MS,
  generating_images: TIMEOUT_IMAGE_EXTENDED_MS,
  evaluating: TIMEOUT_IMAGE_EXTENDED_MS,
  packaging: TIMEOUT_PACKAGE_EXTENDED_MS,
};
