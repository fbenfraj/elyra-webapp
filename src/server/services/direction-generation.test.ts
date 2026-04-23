import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock all external dependencies before imports
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/server/providers/fal", () => ({
  falAdapter: {
    generate: vi.fn(),
  },
}));

vi.mock("@/server/services/storage", () => ({
  uploadImageFromUrl: vi.fn(),
  getSignedImageUrl: vi.fn(),
}));

vi.mock("@/server/services/session", () => ({
  updateSessionStatus: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-model"),
}));

import { generateDirections, getDirectionsForSession } from "./direction-generation";
import { db } from "@/server/db";
import { falAdapter } from "@/server/providers/fal";
import { uploadImageFromUrl, getSignedImageUrl } from "@/server/services/storage";
import { updateSessionStatus } from "@/server/services/session";
import { generateObject } from "ai";

const mockVisualSpec = {
  palette: ["#0a0a0a", "#1a1a2e", "#16213e", "#0f3460", "#533483"],
  mood: "dark cinematic urban",
  composition: "centered figure, urban backdrop",
  style: "photographic, high contrast",
  culturalReferences: ["Playboi Carti WLR", "Travis Scott"],
  genreContext: "trap",
};

const mockLLMDirections = {
  directions: [
    {
      approach: "literal",
      moodLabel: "Dark urban grit",
      tags: ["gritty", "noir"],
      colorPalette: ["#0a0a0a", "#1a1a2e", "#16213e", "#0f3460", "#533483"],
      description: "A literal urban interpretation.",
      imagePrompt: "dark urban scene with neon lights",
    },
    {
      approach: "conceptual",
      moodLabel: "Abstract distortion",
      tags: ["abstract", "fluid"],
      colorPalette: ["#1a0a2e", "#2e1a3e", "#3e162e", "#600f34", "#834953"],
      description: "A conceptual abstract take.",
      imagePrompt: "abstract fluid shapes with dark tones",
    },
    {
      approach: "atmospheric",
      moodLabel: "Midnight atmosphere",
      tags: ["atmospheric", "vast"],
      colorPalette: ["#090b0a", "#1a2e1a", "#16213e", "#340f60", "#534883"],
      description: "An atmospheric environmental interpretation.",
      imagePrompt: "vast midnight landscape with fog",
    },
  ],
};

describe("generateDirections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when visual spec not found", async () => {
    // Mock DB select chain for visual spec lookup
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: () => ({ where: () => Promise.resolve([]) }),
    }));

    const result = await generateDirections("session-1", "user-1", "spec-999");

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("SPEC_NOT_FOUND");
  });

  it("orchestrates full direction generation flow", async () => {
    // Mock DB: fetch visual spec
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve([{ specData: mockVisualSpec }]),
      }),
    }));

    // Mock DB: insert generation job
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      values: () => Promise.resolve(),
    }));

    // Mock LLM response
    (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: mockLLMDirections,
      usage: { inputTokens: 500, outputTokens: 300 },
    });

    // Mock fal.ai: return image URLs
    (falAdapter.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
      imageUrl: "https://fal.ai/generated/image.webp",
      width: 1024,
      height: 1024,
      costCents: 0.3,
      durationMs: 5000,
    });

    // Mock storage
    (uploadImageFromUrl as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (getSignedImageUrl as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => Promise.resolve(`https://r2.signed/${key}`)
    );

    // Mock session status update
    (updateSessionStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await generateDirections("session-1", "user-1", "spec-1");

    expect(result.ok).toBe(true);
    expect(result.output).toHaveLength(3);
    expect(result.output![0].moodLabel).toBe("Dark urban grit");
    expect(result.output![0].tags).toEqual(["gritty", "noir"]);
    expect(result.output![0].colorPalette).toHaveLength(5);
    expect(result.output![0].heroImageUrl).toContain("r2.signed");
    expect(result.output![0].supportingImageUrls).toHaveLength(2);
    expect(result.meta.costCents).toBeGreaterThan(0);
    expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);

    // Verify session status updated to complete
    expect(updateSessionStatus).toHaveBeenCalledWith("session-1", "complete");

    // Verify images were uploaded (3 hero + 3*2 supporting = 9 total)
    expect(uploadImageFromUrl).toHaveBeenCalledTimes(9);

    // Verify generation job was stored
    expect(db.insert).toHaveBeenCalled();
  });

  it("handles generation failure gracefully", async () => {
    // Mock DB: fetch visual spec succeeds
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve([{ specData: mockVisualSpec }]),
      }),
    }));

    // Mock LLM throws
    (generateObject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("LLM API failed")
    );

    // Mock session status update
    (updateSessionStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await generateDirections("session-1", "user-1", "spec-1");

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("DIRECTION_GENERATION_FAILED");

    // Verify session marked as failed
    expect(updateSessionStatus).toHaveBeenCalledWith("session-1", "failed");
  });
});

describe("getDirectionsForSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no directions exist", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
        }),
      }),
    }));

    const result = await getDirectionsForSession("session-999");
    expect(result).toBeNull();
  });

  it("returns directions with fresh signed URLs and generationJobId when they exist", async () => {
    const storedDirections = [
      {
        id: "dir-1",
        heroImageKey: "sessions/session-1/directions/0/hero.webp",
        moodLabel: "Dark urban grit",
        tags: ["gritty", "noir"],
        supportingImageKeys: ["sessions/session-1/directions/0/support-0.webp"],
        colorPalette: ["#000", "#111", "#222", "#333", "#444"],
        description: "Test direction",
      },
    ];

    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: () => ({
        where: () => ({
          orderBy: () =>
            Promise.resolve([{ id: "job-42", directionData: { directions: storedDirections } }]),
        }),
      }),
    }));

    (getSignedImageUrl as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => Promise.resolve(`https://r2.signed/${key}`)
    );

    const result = await getDirectionsForSession("session-1");
    expect(result).not.toBeNull();
    expect(result!.generationJobId).toBe("job-42");
    expect(result!.directions).toHaveLength(1);
    expect(result!.directions[0].heroImageUrl).toBe("https://r2.signed/sessions/session-1/directions/0/hero.webp");
    expect(result!.directions[0].supportingImageUrls).toEqual([
      "https://r2.signed/sessions/session-1/directions/0/support-0.webp",
    ]);
    expect(result!.directions[0].moodLabel).toBe("Dark urban grit");
  });
});
