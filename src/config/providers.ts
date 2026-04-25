import "server-only";

export const INTERPRETATION_MODEL = "gpt-4.1" as const;

export const INTERPRETATION_FALLBACK_MODEL = "gpt-4o" as const;

export const MODERATION_CATEGORIES_BLOCKED = [
  "violence",
  "sexual",
  "self-harm",
  "illicit",
] as const;

// fal.ai image generation — unified model for preview and final
export const FAL_PREVIEW_MODEL = "fal-ai/flux-pro/v1.1" as const;
export const FAL_COST_PER_IMAGE_CENTS = 5;

// Direction generation
export const DIRECTION_PROMPT_MODEL = "gpt-4.1" as const;
export const DIRECTION_COUNT = 3;
export const DIRECTION_SUPPORTING_IMAGES = 2;
export const DIRECTION_IMAGE_WIDTH = 1024;
export const DIRECTION_IMAGE_HEIGHT = 1024;

// fal.ai final image generation (same model as preview)
export const FAL_FINAL_MODEL = "fal-ai/flux-pro/v1.1" as const;
export const FAL_FINAL_COST_PER_IMAGE_CENTS = 5;
export const FINAL_IMAGE_COUNT = 4;

// fal.ai Kontext Multi — image-conditioned generation
export const FAL_KONTEXT_MULTI_MODEL = "fal-ai/flux-pro/kontext/multi" as const;
export const FAL_KONTEXT_COST_PER_IMAGE_CENTS = 8;

// Minimum reference image dimensions (below this, skip the image)
export const REFERENCE_IMAGE_MIN_SIZE = 300;

// Prompt prefix for Kontext Multi reference-conditioned generation
export const KONTEXT_REFERENCE_PREFIX_FULL = `You are generating an image using reference images for visual grounding.

Reference image roles:
- Image 1: Artist identity — preserve the visual identity, appearance, and persona
- Image 2: Visual style — use the artistic style, colors, and visual language
- Image 3: Mood and palette — incorporate the atmosphere, mood, and color palette

Generate the following:
` as const;

export const KONTEXT_REFERENCE_PREFIX_TWO = `You are generating an image using reference images for visual grounding.

Reference image roles:
- Image 1: Artist identity — preserve the visual identity, appearance, and persona
- Image 2: Visual style and mood — use the artistic style, colors, mood, and atmosphere

Generate the following:
` as const;

export const KONTEXT_REFERENCE_PREFIX_ONE = `You are generating an image using a reference image for visual grounding.

Reference image role:
- Image 1: Artist identity — preserve the visual identity, appearance, and persona

Generate the following:
` as const;

// Guidance scale for user-selected references (stronger style matching)
export const USER_SELECTED_GUIDANCE_SCALE = 5.0;

// Guidance scale for auto-Spotify references (current default)
export const AUTO_REFERENCE_GUIDANCE_SCALE = 3.5;

// Unified style-matching prompt prefix for user-selected references
export const USER_SELECTED_REFERENCE_PREFIX = `Using the provided reference images as strong style guides, generate an image that closely matches their artistic style, color palette, composition techniques, and visual aesthetic.

Generate the following:
` as const;

export function getKontextReferencePrefix(imageCount: number): string {
  if (imageCount >= 3) return KONTEXT_REFERENCE_PREFIX_FULL;
  if (imageCount === 2) return KONTEXT_REFERENCE_PREFIX_TWO;
  return KONTEXT_REFERENCE_PREFIX_ONE;
}
export const FINAL_IMAGE_WIDTH = 1024;
export const FINAL_IMAGE_HEIGHT = 1024;

// Cloudflare R2
export const R2_SIGNED_URL_EXPIRY_SECONDS = 3600;

// Model routing — preview and final use the same model for now
export type ProviderTier = "preview" | "final";

export type ModelRoute = {
  provider: string;
  model: string;
};

export const MODEL_ROUTING = {
  imageGeneration: {
    preview: { provider: "fal", model: FAL_PREVIEW_MODEL } satisfies ModelRoute,
    final: { provider: "fal", model: FAL_FINAL_MODEL } satisfies ModelRoute,
  },
  evaluation: {
    primary: { provider: "openai", model: "gpt-4o" } satisfies ModelRoute,
    fallback: { provider: "anthropic", model: "claude-sonnet-4-6" } satisfies ModelRoute,
  },
  interpretation: {
    primary: { provider: "openai", model: INTERPRETATION_MODEL } satisfies ModelRoute,
    fallback: { provider: "openai", model: INTERPRETATION_FALLBACK_MODEL } satisfies ModelRoute,
  },
} as const;

// Fallback chains (Story 6.2)
export const FALLBACK_CHAINS = {
  imageGeneration: {
    preview: ["fal"],      // No fallback for preview
    final: ["fal"],        // Add more providers later
  },
  evaluation: ["openai", "anthropic"],
  interpretation: ["openai"],
} as const;

export const RETRY_CONFIG: Record<string, { maxRetries: number; retryDelayMs: number; timeoutMs: number }> = {
  fal: { maxRetries: 2, retryDelayMs: 1000, timeoutMs: 30_000 },
  openai: { maxRetries: 2, retryDelayMs: 1000, timeoutMs: 60_000 },
  anthropic: { maxRetries: 2, retryDelayMs: 1000, timeoutMs: 60_000 },
};

export const CIRCUIT_BREAKER_CONFIG = {
  /** Number of consecutive failures before opening the circuit. */
  failureThreshold: 5,
  /** Duration in ms the circuit stays open before transitioning to half-open. */
  cooldownMs: 20_000,
} as const;
