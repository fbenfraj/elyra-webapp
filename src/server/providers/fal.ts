import "server-only";

import { fal } from "@fal-ai/client";
import type { ImageGenerationAdapter } from "./image-generation";
import type {
  ProviderCapability,
  ProviderHealth,
  ImageGenOptions,
  ImageGenResult,
} from "@/types/provider";
import { FAL_PREVIEW_MODEL, FAL_COST_PER_IMAGE_CENTS } from "@/config/providers";

fal.config({
  credentials: process.env.FAL_KEY,
});

export const falAdapter: ImageGenerationAdapter = {
  async generate(prompt: string, options: ImageGenOptions): Promise<ImageGenResult> {
    const start = Date.now();

    const result = await fal.subscribe(FAL_PREVIEW_MODEL, {
      input: {
        prompt,
        image_size: {
          width: options.width,
          height: options.height,
        },
        num_images: 1,
      },
    });

    const image = result.data.images?.[0];
    if (!image) {
      throw new Error("fal.ai returned no images");
    }

    return {
      imageUrl: image.url,
      width: image.width ?? options.width,
      height: image.height ?? options.height,
      costCents: FAL_COST_PER_IMAGE_CENTS,
      durationMs: Date.now() - start,
    };
  },

  async getHealth(): Promise<ProviderHealth> {
    return {
      status: "healthy",
      lastChecked: new Date(),
      latencyMs: null,
      errorCount: 0,
    };
  },

  estimateCost(options: ImageGenOptions): number {
    return FAL_COST_PER_IMAGE_CENTS * options.numImages;
  },

  supports(capability: ProviderCapability): boolean {
    return capability === "image-generation";
  },
};
