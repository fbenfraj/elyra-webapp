import { describe, it, expect } from "vitest";
import { getRubricWeights, RUBRIC_WEIGHTS, GENRE_RUBRIC_OVERRIDES } from "@/config/evaluation";

describe("getRubricWeights", () => {
  it("returns default weights when no genre is provided", () => {
    expect(getRubricWeights()).toEqual(RUBRIC_WEIGHTS);
  });

  it("returns default weights for undefined genre", () => {
    expect(getRubricWeights(undefined)).toEqual(RUBRIC_WEIGHTS);
  });

  it("returns default weights for unknown genre", () => {
    expect(getRubricWeights("nonexistent-genre")).toEqual(RUBRIC_WEIGHTS);
  });

  it("returns overridden weights for a known genre", () => {
    // Temporarily add a test override
    const original = { ...GENRE_RUBRIC_OVERRIDES };
    (GENRE_RUBRIC_OVERRIDES as Record<string, unknown>)["testgenre"] = {
      moodAlignment: 0.35,
      composition: 0.10,
    };

    const result = getRubricWeights("testgenre");

    expect(result.moodAlignment).toBe(0.35);
    expect(result.composition).toBe(0.10);
    // Non-overridden weights stay at default
    expect(result.colorAccuracy).toBe(RUBRIC_WEIGHTS.colorAccuracy);
    expect(result.textAccuracy).toBe(RUBRIC_WEIGHTS.textAccuracy);
    expect(result.brandConsistency).toBe(RUBRIC_WEIGHTS.brandConsistency);

    // Cleanup
    Object.keys(GENRE_RUBRIC_OVERRIDES).forEach((k) => {
      if (!(k in original)) {
        delete (GENRE_RUBRIC_OVERRIDES as Record<string, unknown>)[k];
      }
    });
  });

  it("is case-insensitive for genre lookup", () => {
    (GENRE_RUBRIC_OVERRIDES as Record<string, unknown>)["casetest"] = {
      composition: 0.30,
    };

    const result = getRubricWeights("CaseTest");
    expect(result.composition).toBe(0.30);

    delete (GENRE_RUBRIC_OVERRIDES as Record<string, unknown>)["casetest"];
  });
});
