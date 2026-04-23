import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-share-id"),
}));

// Mock db
const mockWhere = vi.fn();
const mockSetWhere = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...args: unknown[]) => mockWhere(...args),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: (...wArgs: unknown[]) => mockSetWhere(...wArgs),
      })),
    })),
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: { id: "id", userId: "userId", shareId: "shareId", selectedDirectionId: "sdi", selectedGenerationJobId: "sgji" },
}));

vi.mock("@/server/db/schema/generation-jobs", () => ({
  generationJobs: { id: "id", directionData: "directionData" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  sql: Object.assign(
    (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(""),
    { raw: vi.fn() }
  ),
}));

describe("createShareLinkForSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://elyra.app";
  });

  it("creates a new share link when none exists", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "s1", userId: "u1", shareId: null },
    ]);
    mockSetWhere.mockResolvedValue(undefined);

    const { createShareLinkForSession } = await import("@/server/services/sharing");
    const result = await createShareLinkForSession("s1", "u1");

    expect(result.shareId).toBe("test-share-id");
    expect(result.shareUrl).toBe("https://elyra.app/direction/test-share-id");
  });

  it("returns existing share link if already created", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "s1", userId: "u1", shareId: "existing-id" },
    ]);

    const { createShareLinkForSession } = await import("@/server/services/sharing");
    const result = await createShareLinkForSession("s1", "u1");

    expect(result.shareId).toBe("existing-id");
    expect(result.shareUrl).toBe("https://elyra.app/direction/existing-id");
  });

  it("throws when session not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { createShareLinkForSession } = await import("@/server/services/sharing");
    await expect(createShareLinkForSession("bad", "u1")).rejects.toThrow("Session not found");
  });
});

describe("getSharedDirection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns direction data for valid share ID", async () => {
    mockWhere
      .mockResolvedValueOnce([
        { id: "s1", selectedDirectionId: "dir-1", selectedGenerationJobId: "job-1" },
      ])
      .mockResolvedValueOnce([
        {
          directionData: {
            directions: [
              {
                id: "dir-1",
                moodLabel: "Dark ambient",
                description: "Moody atmospheric sounds",
                colorPalette: ["#000000", "#111111", "#222222", "#333333", "#444444"],
                tags: ["dark", "ambient"],
                heroImageKey: "key",
                supportingImageKeys: [],
              },
            ],
          },
        },
      ]);

    const { getSharedDirection } = await import("@/server/services/sharing");
    const result = await getSharedDirection("test-share-id");

    expect(result).not.toBeNull();
    expect(result!.moodLabel).toBe("Dark ambient");
    expect(result!.description).toBe("Moody atmospheric sounds");
    expect(result!.palette).toHaveLength(5);
    expect(result!.tags).toEqual(["dark", "ambient"]);
  });

  it("returns null for unknown share ID", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { getSharedDirection } = await import("@/server/services/sharing");
    const result = await getSharedDirection("unknown");

    expect(result).toBeNull();
  });
});
