import "server-only";

import { falAdapter } from "@/server/providers/fal";
import { openaiEvaluationAdapter } from "@/server/providers/openai";
import { anthropicEvaluationAdapter } from "@/server/providers/anthropic";
import { MODEL_ROUTING } from "@/config/providers";
import type { ProviderTier } from "@/config/providers";
import type { ImageGenerationAdapter, EvaluationAdapter } from "@/server/providers/image-generation";

export function getImageAdapter(_tier: ProviderTier): ImageGenerationAdapter {
  // Only fal.ai is supported for image generation at this time
  return falAdapter;
}

export function getEvaluationAdapter(role: "primary" | "fallback"): EvaluationAdapter {
  const route = MODEL_ROUTING.evaluation[role];
  if (route.provider === "openai") return openaiEvaluationAdapter;
  if (route.provider === "anthropic") return anthropicEvaluationAdapter;
  throw new Error(`Unknown evaluation provider: ${route.provider}`);
}
