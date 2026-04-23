import "server-only";

import { fal } from "@fal-ai/client";
import type { ImageGenerationAdapter } from "./image-generation";
import type {
  ProviderCapability,
  ProviderHealth,
  ImageGenOptions,
  ImageGenResult,
} from "@/types/provider";
import {
  FAL_PREVIEW_MODEL,
  FAL_COST_PER_IMAGE_CENTS,
  FAL_FINAL_MODEL,
  FAL_FINAL_COST_PER_IMAGE_CENTS,
} from "@/config/providers";

fal.config({
  credentials: process.env.FAL_KEY,
});

function getCostForModel(model: string): number {
  if (model === FAL_FINAL_MODEL) return FAL_FINAL_COST_PER_IMAGE_CENTS;
  return FAL_COST_PER_IMAGE_CENTS;
}

export const falAdapter: ImageGenerationAdapter = {
  async generate(prompt: string, options: ImageGenOptions): Promise<ImageGenResult> {
    const start = Date.now();
    const modelId = options.model || FAL_PREVIEW_MODEL;

    const result = await fal.subscribe(modelId, {
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

    const durationMs = Date.now() - start;

    console.info(JSON.stringify({
      event: "provider_call",
      provider: "fal",
      model: modelId,
      durationMs,
      success: true,
    }));

    return {
      imageUrl: image.url,
      width: image.width ?? options.width,
      height: image.height ?? options.height,
      costCents: getCostForModel(modelId),
      durationMs,
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
    return getCostForModel(options.model) * options.numImages;
  },

  supports(capability: ProviderCapability): boolean {
    return capability === "image-generation";
  },
};
