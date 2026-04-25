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

// fal.ai final image generation (Flux 2 Pro)
export const FAL_FINAL_MODEL = "fal-ai/flux-pro/v1.1" as const;
export const FAL_FINAL_COST_PER_IMAGE_CENTS = 5;
export const FINAL_IMAGE_COUNT = 4;
export const FINAL_IMAGE_WIDTH = 1024;
export const FINAL_IMAGE_HEIGHT = 1024;

// Cloudflare R2
export const R2_SIGNED_URL_EXPIRY_SECONDS = 3600;

// Tiered model routing (Story 6.1)
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
