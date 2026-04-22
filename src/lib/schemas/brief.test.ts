import { describe, it, expect } from "vitest";
import { briefInputSchema } from "./brief";

describe("briefInputSchema", () => {
  it("accepts a normal brief", () => {
    const result = briefInputSchema.parse({
      text: "dark cinematic trap, nighttime city, moody blue tones",
    });
    expect(result.text).toBe(
      "dark cinematic trap, nighttime city, moody blue tones"
    );
  });

  it("trims whitespace from text", () => {
    const result = briefInputSchema.parse({
      text: "  moody blue tones  ",
    });
    expect(result.text).toBe("moody blue tones");
  });

  it("rejects empty string", () => {
    expect(() => briefInputSchema.parse({ text: "" })).toThrow();
  });

  it("rejects whitespace-only string", () => {
    expect(() => briefInputSchema.parse({ text: "   " })).toThrow();
  });

  it("accepts long input", () => {
    const longText = "a".repeat(1000);
    const result = briefInputSchema.parse({ text: longText });
    expect(result.text).toBe(longText);
  });
});
