/**
 * Shared types for provider adapters.
 */

export type ProviderCapability =
  | "image-generation"
  | "image-evaluation"
  | "text-interpretation"
  | "video-generation";

export type ProviderHealthStatus = "healthy" | "degraded" | "down";

export type ProviderHealth = {
  status: ProviderHealthStatus;
  lastChecked: Date;
  latencyMs: number | null;
  errorCount: number;
};

export type ImageGenOptions = {
  width: number;
  height: number;
  model: string;
  numImages: number;
};

export type ImageGenResult = {
  imageUrl: string;
  width: number;
  height: number;
  costCents: number;
  durationMs: number;
};
