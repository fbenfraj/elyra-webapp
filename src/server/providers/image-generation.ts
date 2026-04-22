import "server-only";

import type {
  ProviderCapability,
  ProviderHealth,
  ImageGenOptions,
  ImageGenResult,
} from "@/types/provider";

export interface ImageGenerationAdapter {
  generate(prompt: string, options: ImageGenOptions): Promise<ImageGenResult>;
  getHealth(): Promise<ProviderHealth>;
  estimateCost(options: ImageGenOptions): number;
  supports(capability: ProviderCapability): boolean;
}
