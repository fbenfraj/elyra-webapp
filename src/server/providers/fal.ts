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
  FAL_KONTEXT_MULTI_MODEL,
  FAL_KONTEXT_COST_PER_IMAGE_CENTS,
} from "@/config/providers";

fal.config({
  credentials: process.env.FAL_KEY,
});

function getCostForModel(model: string): number {
  if (model === FAL_KONTEXT_MULTI_MODEL) return FAL_KONTEXT_COST_PER_IMAGE_CENTS;
  if (model === FAL_FINAL_MODEL) return FAL_FINAL_COST_PER_IMAGE_CENTS;
  return FAL_COST_PER_IMAGE_CENTS;
}

// ---------------------------------------------------------------------------
// Internal generation helpers
// ---------------------------------------------------------------------------

async function generateTextToImage(
  prompt: string,
  options: ImageGenOptions
): Promise<ImageGenResult> {
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

  console.info(
    JSON.stringify({
      event: "provider_call",
      provider: "fal",
      model: modelId,
      durationMs,
      success: true,
    })
  );

  return {
    imageUrl: image.url,
    width: image.width ?? options.width,
    height: image.height ?? options.height,
    costCents: getCostForModel(modelId),
    durationMs,
  };
}

async function generateWithReferences(
  prompt: string,
  options: ImageGenOptions
): Promise<ImageGenResult> {
  const start = Date.now();

  const result = await fal.subscribe(FAL_KONTEXT_MULTI_MODEL, {
    input: {
      prompt,
      image_urls: options.referenceImages ?? [],
      num_images: 1,
      output_format: "jpeg",
      guidance_scale: 3.5,
    },
  });

  const image = result.data.images?.[0];
  if (!image) {
    throw new Error("fal.ai Kontext Multi returned no images");
  }

  const durationMs = Date.now() - start;

  console.info(
    JSON.stringify({
      event: "provider_call",
      provider: "fal",
      model: FAL_KONTEXT_MULTI_MODEL,
      mode: "kontext_multi",
      referenceCount: options.referenceImages?.length,
      durationMs,
      success: true,
    })
  );

  return {
    imageUrl: image.url,
    width: image.width ?? options.width,
    height: image.height ?? options.height,
    costCents: FAL_KONTEXT_COST_PER_IMAGE_CENTS,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const falAdapter: ImageGenerationAdapter = {
  async generate(
    prompt: string,
    options: ImageGenOptions
  ): Promise<ImageGenResult> {
    if (options.referenceImages && options.referenceImages.length > 0) {
      return generateWithReferences(prompt, options);
    }
    return generateTextToImage(prompt, options);
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
    if (options.referenceImages && options.referenceImages.length > 0) {
      return FAL_KONTEXT_COST_PER_IMAGE_CENTS * options.numImages;
    }
    return getCostForModel(options.model) * options.numImages;
  },

  supports(capability: ProviderCapability): boolean {
    return capability === "image-generation";
  },
};
