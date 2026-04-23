import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockFalAdapter, mockOpenaiEvaluationAdapter, mockAnthropicEvaluationAdapter } = vi.hoisted(() => ({
  mockFalAdapter: {
    generate: vi.fn(),
    getHealth: vi.fn(),
    estimateCost: vi.fn(),
    supports: vi.fn(),
  },
  mockOpenaiEvaluationAdapter: {
    evaluate: vi.fn(),
    getHealth: vi.fn(),
    estimateCost: vi.fn(),
  },
  mockAnthropicEvaluationAdapter: {
    evaluate: vi.fn(),
    getHealth: vi.fn(),
    estimateCost: vi.fn(),
  },
}));

vi.mock("@/server/providers/fal", () => ({
  falAdapter: mockFalAdapter,
}));

vi.mock("@/server/providers/openai", () => ({
  openaiEvaluationAdapter: mockOpenaiEvaluationAdapter,
}));

vi.mock("@/server/providers/anthropic", () => ({
  anthropicEvaluationAdapter: mockAnthropicEvaluationAdapter,
}));

import { getImageAdapter, getEvaluationAdapter } from "./provider-routing";

describe("getImageAdapter", () => {
  it("returns an adapter for preview tier", () => {
    const adapter = getImageAdapter("preview");
    expect(adapter).toBe(mockFalAdapter);
  });

  it("returns an adapter for final tier", () => {
    const adapter = getImageAdapter("final");
    expect(adapter).toBe(mockFalAdapter);
  });
});

describe("getEvaluationAdapter", () => {
  it("returns openai adapter for primary role", () => {
    const adapter = getEvaluationAdapter("primary");
    expect(adapter).toBe(mockOpenaiEvaluationAdapter);
  });

  it("returns anthropic adapter for fallback role", () => {
    const adapter = getEvaluationAdapter("fallback");
    expect(adapter).toBe(mockAnthropicEvaluationAdapter);
  });
});
