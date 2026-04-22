import { describe, it, expect } from "vitest";
import { directionSchema, directionDataSchema } from "./direction";

const validDirection = {
  id: "dir-1",
  heroImageUrl: "https://r2.example.com/hero.webp",
  moodLabel: "Dark cinematic / urban isolation",
  tags: ["gritty", "noir"],
  supportingImageUrls: [
    "https://r2.example.com/support1.webp",
    "https://r2.example.com/support2.webp",
  ],
  colorPalette: ["#0a0a0a", "#1a1a2e", "#16213e", "#0f3460", "#533483"],
  description:
    "A literal interpretation of urban darkness with cinematic framing.",
};

describe("directionSchema", () => {
  it("accepts a valid direction", () => {
    const result = directionSchema.safeParse(validDirection);
    expect(result.success).toBe(true);
  });

  it("requires at least 2 tags", () => {
    const result = directionSchema.safeParse({
      ...validDirection,
      tags: ["single"],
    });
    expect(result.success).toBe(false);
  });

  it("allows at most 3 tags", () => {
    const result = directionSchema.safeParse({
      ...validDirection,
      tags: ["a", "b", "c", "d"],
    });
    expect(result.success).toBe(false);
  });

  it("requires exactly 5 color palette entries", () => {
    const result = directionSchema.safeParse({
      ...validDirection,
      colorPalette: ["#000", "#111", "#222"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = directionSchema.safeParse({
      id: "dir-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("directionDataSchema", () => {
  it("accepts 2-3 valid directions", () => {
    const result = directionDataSchema.safeParse({
      directions: [
        validDirection,
        { ...validDirection, id: "dir-2", moodLabel: "Conceptual abstract" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts 3 directions", () => {
    const result = directionDataSchema.safeParse({
      directions: [
        validDirection,
        { ...validDirection, id: "dir-2" },
        { ...validDirection, id: "dir-3" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects fewer than 2 directions", () => {
    const result = directionDataSchema.safeParse({
      directions: [validDirection],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 directions", () => {
    const result = directionDataSchema.safeParse({
      directions: [
        validDirection,
        { ...validDirection, id: "dir-2" },
        { ...validDirection, id: "dir-3" },
        { ...validDirection, id: "dir-4" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
