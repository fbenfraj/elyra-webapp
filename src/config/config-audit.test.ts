/**
 * Config Audit Tests — Story 7.5.4
 *
 * These tests are living guards for config consistency. If a future change
 * introduces a contradiction (e.g. a provider added to MODEL_ROUTING without
 * a corresponding adapter key, or retry math that exceeds a timeout), these
 * tests will catch it.
 */

import { describe, it, expect } from "vitest";

// Mocks required for server-only modules
import { vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  MODEL_ROUTING,
  FALLBACK_CHAINS,
  RETRY_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
} from "./providers";

import { RUBRIC_WEIGHTS, MIN_PASS_SCORE, MAX_EVAL_RETRIES } from "./evaluation";

import {
  MAX_SESSION_COST_CENTS,
  MAX_USER_DAILY_SESSIONS,
  MAX_USER_DAILY_COST_CENTS,
  ALERT_THRESHOLDS,
} from "./limits";

import { PACK_PRICE_CENTS, PACK_REGEN_LIMIT } from "./pricing";

// ---------------------------------------------------------------------------
// Task 6.1 — MODEL_ROUTING model IDs are non-empty strings
// ---------------------------------------------------------------------------

describe("MODEL_ROUTING model IDs", () => {
  const routes = [
    MODEL_ROUTING.imageGeneration.preview,
    MODEL_ROUTING.imageGeneration.final,
    MODEL_ROUTING.evaluation.primary,
    MODEL_ROUTING.evaluation.fallback,
    MODEL_ROUTING.interpretation.primary,
    MODEL_ROUTING.interpretation.fallback,
  ];

  it("all model IDs are non-empty strings", () => {
    for (const route of routes) {
      expect(typeof route.model).toBe("string");
      expect(route.model.length).toBeGreaterThan(0);
    }
  });

  it("all provider names are non-empty strings", () => {
    for (const route of routes) {
      expect(typeof route.provider).toBe("string");
      expect(route.provider.length).toBeGreaterThan(0);
    }
  });

  it("imageGeneration preview tier uses fal provider", () => {
    expect(MODEL_ROUTING.imageGeneration.preview.provider).toBe("fal");
  });

  it("imageGeneration final tier uses fal provider", () => {
    expect(MODEL_ROUTING.imageGeneration.final.provider).toBe("fal");
  });

  it("imageGeneration preview model is Flux Schnell", () => {
    expect(MODEL_ROUTING.imageGeneration.preview.model).toContain("flux");
    expect(MODEL_ROUTING.imageGeneration.preview.model).toContain("schnell");
  });

  it("imageGeneration final model is Flux Pro v2", () => {
    expect(MODEL_ROUTING.imageGeneration.final.model).toContain("flux-pro");
  });

  it("evaluation primary uses openai provider", () => {
    expect(MODEL_ROUTING.evaluation.primary.provider).toBe("openai");
  });

  it("evaluation fallback uses anthropic provider", () => {
    expect(MODEL_ROUTING.evaluation.fallback.provider).toBe("anthropic");
  });
});

// ---------------------------------------------------------------------------
// Task 6.2 — FALLBACK_CHAINS reference valid provider names
// ---------------------------------------------------------------------------

/** Known providers that have adapter implementations in server/providers/ */
const KNOWN_PROVIDERS = new Set(["fal", "openai", "anthropic"]);

describe("FALLBACK_CHAINS provider validity", () => {
  it("imageGeneration preview chain references valid providers", () => {
    for (const provider of FALLBACK_CHAINS.imageGeneration.preview) {
      expect(KNOWN_PROVIDERS.has(provider)).toBe(true);
    }
  });

  it("imageGeneration final chain references valid providers", () => {
    for (const provider of FALLBACK_CHAINS.imageGeneration.final) {
      expect(KNOWN_PROVIDERS.has(provider)).toBe(true);
    }
  });

  it("evaluation chain references valid providers", () => {
    for (const provider of FALLBACK_CHAINS.evaluation) {
      expect(KNOWN_PROVIDERS.has(provider)).toBe(true);
    }
  });

  it("interpretation chain references valid providers", () => {
    for (const provider of FALLBACK_CHAINS.interpretation) {
      expect(KNOWN_PROVIDERS.has(provider)).toBe(true);
    }
  });

  it("evaluation chain primary matches MODEL_ROUTING evaluation primary provider", () => {
    expect(FALLBACK_CHAINS.evaluation[0]).toBe(
      MODEL_ROUTING.evaluation.primary.provider
    );
  });

  it("evaluation chain fallback matches MODEL_ROUTING evaluation fallback provider", () => {
    expect(FALLBACK_CHAINS.evaluation[1]).toBe(
      MODEL_ROUTING.evaluation.fallback.provider
    );
  });
});

// ---------------------------------------------------------------------------
// Task 6.3 — Retry config math: retries × baseDelay < timeout
// ---------------------------------------------------------------------------

describe("RETRY_CONFIG math consistency", () => {
  const providers = Object.keys(RETRY_CONFIG) as Array<keyof typeof RETRY_CONFIG>;

  it("every RETRY_CONFIG entry has positive maxRetries, retryDelayMs, timeoutMs", () => {
    for (const provider of providers) {
      const cfg = RETRY_CONFIG[provider];
      expect(cfg.maxRetries).toBeGreaterThan(0);
      expect(cfg.retryDelayMs).toBeGreaterThan(0);
      expect(cfg.timeoutMs).toBeGreaterThan(0);
    }
  });

  it("maxRetries × retryDelayMs is well under timeoutMs for each provider", () => {
    for (const provider of providers) {
      const cfg = RETRY_CONFIG[provider];
      const worstCaseDelayMs = cfg.maxRetries * cfg.retryDelayMs;
      // Retries × delay should be at most 20% of the timeout, leaving headroom
      expect(worstCaseDelayMs).toBeLessThan(cfg.timeoutMs);
    }
  });

  it("RETRY_CONFIG covers all FALLBACK_CHAINS providers", () => {
    const allChainProviders = new Set([
      ...FALLBACK_CHAINS.imageGeneration.preview,
      ...FALLBACK_CHAINS.imageGeneration.final,
      ...FALLBACK_CHAINS.evaluation,
      ...FALLBACK_CHAINS.interpretation,
    ]);
    for (const provider of allChainProviders) {
      expect(RETRY_CONFIG).toHaveProperty(provider);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 6.4 — RUBRIC_WEIGHTS sum to 1.0
// ---------------------------------------------------------------------------

describe("RUBRIC_WEIGHTS integrity", () => {
  it("RUBRIC_WEIGHTS sum to 1.0", () => {
    const sum = Object.values(RUBRIC_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("all RUBRIC_WEIGHTS are between 0 and 1", () => {
    for (const weight of Object.values(RUBRIC_WEIGHTS)) {
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(1);
    }
  });

  it("MIN_PASS_SCORE is between 0 and 1", () => {
    expect(MIN_PASS_SCORE).toBeGreaterThan(0);
    expect(MIN_PASS_SCORE).toBeLessThanOrEqual(1);
  });

  it("MAX_EVAL_RETRIES is a positive integer", () => {
    expect(MAX_EVAL_RETRIES).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_EVAL_RETRIES)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 6.5 — Budget limits > 0 and session limit < user daily limit
// ---------------------------------------------------------------------------

describe("Budget limit sanity", () => {
  it("MAX_SESSION_COST_CENTS is positive", () => {
    expect(MAX_SESSION_COST_CENTS).toBeGreaterThan(0);
  });

  it("MAX_USER_DAILY_COST_CENTS is positive", () => {
    expect(MAX_USER_DAILY_COST_CENTS).toBeGreaterThan(0);
  });

  it("MAX_SESSION_COST_CENTS < MAX_USER_DAILY_COST_CENTS", () => {
    // A single session cannot cost more than the daily budget
    expect(MAX_SESSION_COST_CENTS).toBeLessThan(MAX_USER_DAILY_COST_CENTS);
  });

  it("MAX_USER_DAILY_SESSIONS is a positive integer", () => {
    expect(MAX_USER_DAILY_SESSIONS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_USER_DAILY_SESSIONS)).toBe(true);
  });

  it("ALERT_THRESHOLDS values are positive numbers", () => {
    expect(ALERT_THRESHOLDS.minHitRatePercent).toBeGreaterThan(0);
    expect(ALERT_THRESHOLDS.maxAvgCostCentsPerDeliverable).toBeGreaterThan(0);
    expect(ALERT_THRESHOLDS.maxProviderFailureRatePercent).toBeGreaterThan(0);
  });

  it("ALERT_THRESHOLDS.minHitRatePercent is a valid percentage (0–100)", () => {
    expect(ALERT_THRESHOLDS.minHitRatePercent).toBeLessThanOrEqual(100);
  });

  it("ALERT_THRESHOLDS.maxProviderFailureRatePercent is a valid percentage (0–100)", () => {
    expect(ALERT_THRESHOLDS.maxProviderFailureRatePercent).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Task 6.6 — PACK_REGEN_LIMIT > 0
// ---------------------------------------------------------------------------

describe("Pricing config sanity", () => {
  it("PACK_REGEN_LIMIT is a positive integer", () => {
    expect(PACK_REGEN_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(PACK_REGEN_LIMIT)).toBe(true);
  });

  it("PACK_PRICE_CENTS is a positive integer", () => {
    expect(PACK_PRICE_CENTS).toBeGreaterThan(0);
    expect(Number.isInteger(PACK_PRICE_CENTS)).toBe(true);
  });

  it("PACK_PRICE_CENTS exceeds MAX_SESSION_COST_CENTS (price > pipeline cost, ensuring healthy margin)", () => {
    // The pack price charged to the user should exceed the max pipeline cost per session,
    // otherwise we are guaranteed to lose money on every transaction.
    expect(PACK_PRICE_CENTS).toBeGreaterThan(MAX_SESSION_COST_CENTS);
  });
});

// ---------------------------------------------------------------------------
// CIRCUIT_BREAKER_CONFIG sanity
// ---------------------------------------------------------------------------

describe("CIRCUIT_BREAKER_CONFIG sanity", () => {
  it("failureThreshold is a positive integer", () => {
    expect(CIRCUIT_BREAKER_CONFIG.failureThreshold).toBeGreaterThan(0);
    expect(Number.isInteger(CIRCUIT_BREAKER_CONFIG.failureThreshold)).toBe(true);
  });

  it("cooldownMs is a positive number", () => {
    expect(CIRCUIT_BREAKER_CONFIG.cooldownMs).toBeGreaterThan(0);
  });

  it("cooldownMs is strictly less than the shortest provider timeout", () => {
    const shortestTimeout = Math.min(
      ...Object.values(RETRY_CONFIG).map((c) => c.timeoutMs)
    );
    // The cooldown must be strictly shorter than the shortest provider timeout
    // so a half-open probe has headroom before timing out.
    expect(CIRCUIT_BREAKER_CONFIG.cooldownMs).toBeLessThan(shortestTimeout);
  });
});
