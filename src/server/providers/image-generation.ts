import "server-only";

import type {
  ProviderCapability,
  ProviderHealth,
  ImageGenOptions,
  ImageGenResult,
} from "@/types/provider";
import type { EvaluationResult } from "@/lib/schemas/evaluation";

export interface ImageGenerationAdapter {
  generate(prompt: string, options: ImageGenOptions): Promise<ImageGenResult>;
  getHealth(): Promise<ProviderHealth>;
  estimateCost(options: ImageGenOptions): number;
  supports(capability: ProviderCapability): boolean;
}

/** Direction context passed to VLM for evaluation. Shared across all evaluation adapters. */
export type DirectionContext = {
  moodLabel: string;
  colorPalette: string[];
  description: string;
  visualSpecSummary: string;
};

export interface EvaluationAdapter {
  evaluate(
    imageUrl: string,
    rubric: Record<string, number>,
    directionContext: DirectionContext
  ): Promise<{ result: EvaluationResult; costCents: number; durationMs: number }>;
  getHealth(): Promise<ProviderHealth>;
  estimateCost(): number;
}
