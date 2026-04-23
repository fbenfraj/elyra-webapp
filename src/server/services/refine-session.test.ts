import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock db
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return { from: (...a: unknown[]) => { mockFrom(...a); return { where: (...w: unknown[]) => { mockWhere(...w); return []; } }; } };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...s: unknown[]) => {
          mockSet(...s);
          return { where: (...w: unknown[]) => { mockUpdateWhere(...w); return Promise.resolve(); } };
        },
      };
    },
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
    briefText: "brief_text",
    status: "status",
    refinementCount: "refinement_count",
    refinementHistory: "refinement_history",
    updatedAt: "updated_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  sql: { raw: vi.fn() },
}));

vi.mock("@/server/services/session", () => ({
  updateSessionStatus: vi.fn(),
}));

import { composeRefinedBrief } from "./refine-session";

describe("composeRefinedBrief", () => {
  it("composes brief with pills only", () => {
    const result = composeRefinedBrief("dark trap vibes", ["Grittier?", "Darker?"], "");
    expect(result).toContain("Original vision: dark trap vibes");
    expect(result).toContain("Direction adjustments: Grittier?, Darker?");
    expect(result).not.toContain("Additional context:");
  });

  it("composes brief with text only", () => {
    const result = composeRefinedBrief("dark trap vibes", [], "like Arca album covers");
    expect(result).toContain("Original vision: dark trap vibes");
    expect(result).not.toContain("Direction adjustments:");
    expect(result).toContain("Additional context: like Arca album covers");
  });

  it("composes brief with both pills and text", () => {
    const result = composeRefinedBrief(
      "dark trap vibes",
      ["More raw?"],
      "more industrial"
    );
    expect(result).toContain("Original vision: dark trap vibes");
    expect(result).toContain("Direction adjustments: More raw?");
    expect(result).toContain("Additional context: more industrial");
  });

  it("uses double newlines as separator", () => {
    const result = composeRefinedBrief("brief", ["Darker?"], "text");
    const parts = result.split("\n\n");
    expect(parts.length).toBe(3);
  });
});
