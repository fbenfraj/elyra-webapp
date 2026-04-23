import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MODEL_ROUTING,
  FAL_PREVIEW_MODEL,
  FAL_FINAL_MODEL,
  INTERPRETATION_MODEL,
  INTERPRETATION_FALLBACK_MODEL,
} from "./providers";

describe("MODEL_ROUTING", () => {
  it("has imageGeneration routes for preview and final tiers", () => {
    expect(MODEL_ROUTING.imageGeneration.preview).toEqual({
      provider: "fal",
      model: FAL_PREVIEW_MODEL,
    });
    expect(MODEL_ROUTING.imageGeneration.final).toEqual({
      provider: "fal",
      model: FAL_FINAL_MODEL,
    });
  });

  it("has evaluation routes for primary and fallback", () => {
    expect(MODEL_ROUTING.evaluation.primary).toEqual({
      provider: "openai",
      model: "gpt-4o",
    });
    expect(MODEL_ROUTING.evaluation.fallback).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
  });

  it("has interpretation routes for primary and fallback", () => {
    expect(MODEL_ROUTING.interpretation.primary).toEqual({
      provider: "openai",
      model: INTERPRETATION_MODEL,
    });
    expect(MODEL_ROUTING.interpretation.fallback).toEqual({
      provider: "openai",
      model: INTERPRETATION_FALLBACK_MODEL,
    });
  });

  it("uses consistent provider strings", () => {
    const allProviders = [
      MODEL_ROUTING.imageGeneration.preview.provider,
      MODEL_ROUTING.imageGeneration.final.provider,
      MODEL_ROUTING.evaluation.primary.provider,
      MODEL_ROUTING.evaluation.fallback.provider,
      MODEL_ROUTING.interpretation.primary.provider,
      MODEL_ROUTING.interpretation.fallback.provider,
    ];
    for (const provider of allProviders) {
      expect(typeof provider).toBe("string");
      expect(provider.length).toBeGreaterThan(0);
    }
  });
});
