import { describe, it, expect } from "vitest";
import { visualSpecSchema } from "./visual-spec";

describe("visualSpecSchema", () => {
  const validSpec = {
    palette: ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
    mood: "dark cinematic isolation",
    composition: "centered subject with negative space, low-angle perspective",
    style: "photographic realism with muted color grading",
    culturalReferences: ["Blade Runner 2049", "Arca album covers"],
    genreContext: "dark trap",
  };

  it("accepts a valid visual spec", () => {
    const result = visualSpecSchema.parse(validSpec);
    expect(result.mood).toBe("dark cinematic isolation");
    expect(result.palette).toHaveLength(4);
  });

  it("accepts a spec with optional continuityCues", () => {
    const result = visualSpecSchema.parse({
      ...validSpec,
      continuityCues: "similar to my last release, but softer",
    });
    expect(result.continuityCues).toBe(
      "similar to my last release, but softer"
    );
  });

  it("accepts a spec without continuityCues", () => {
    const result = visualSpecSchema.parse(validSpec);
    expect(result.continuityCues).toBeUndefined();
  });

  it("rejects a spec with empty palette", () => {
    expect(() =>
      visualSpecSchema.parse({ ...validSpec, palette: [] })
    ).toThrow();
  });

  it("rejects a spec with empty mood", () => {
    expect(() => visualSpecSchema.parse({ ...validSpec, mood: "" })).toThrow();
  });

  it("rejects a spec with empty genreContext", () => {
    expect(() =>
      visualSpecSchema.parse({ ...validSpec, genreContext: "" })
    ).toThrow();
  });

  it("rejects a spec missing required fields", () => {
    expect(() => visualSpecSchema.parse({ palette: ["#fff"] })).toThrow();
  });
});
