import "server-only";

export const INTERPRETATION_MODEL = "gpt-4.1" as const;

export const INTERPRETATION_FALLBACK_MODEL = "gpt-4o" as const;

export const MODERATION_CATEGORIES_BLOCKED = [
  "violence",
  "sexual",
  "self-harm",
  "illicit",
] as const;

// fal.ai image generation
export const FAL_PREVIEW_MODEL = "fal-ai/flux/schnell" as const;
export const FAL_COST_PER_IMAGE_CENTS = 0.3;

// Direction generation
export const DIRECTION_PROMPT_MODEL = "gpt-4.1" as const;
export const DIRECTION_COUNT = 3;
export const DIRECTION_SUPPORTING_IMAGES = 2;
export const DIRECTION_IMAGE_WIDTH = 1024;
export const DIRECTION_IMAGE_HEIGHT = 1024;

// Cloudflare R2
export const R2_SIGNED_URL_EXPIRY_SECONDS = 3600;
