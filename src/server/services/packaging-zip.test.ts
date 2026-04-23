import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock db
const mockWhere = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...args: unknown[]) => mockWhere(...args),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

// Mock schema
vi.mock("@/server/db/schema/sessions", () => ({
  sessions: { id: "id", userId: "userId", status: "status", selectedDirectionId: "sdi", selectedGenerationJobId: "sgji", shareId: "shareId" },
}));
vi.mock("@/server/db/schema/generation-attempts", () => ({
  generationAttempts: { id: "id", imageKey: "imageKey", generationJobId: "gjId", sessionId: "sId", selected: "selected" },
}));
vi.mock("@/server/db/schema/generation-jobs", () => ({
  generationJobs: { id: "id", directionData: "directionData" },
}));
vi.mock("@/server/db/schema/deliverables", () => ({
  deliverables: { sessionId: "sessionId", format: "format", fileKey: "fileKey" },
}));

// Mock storage
const mockDownloadFromR2 = vi.fn();
const mockUploadImage = vi.fn();
const mockGetSignedImageUrl = vi.fn();

vi.mock("@/server/services/storage", () => ({
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
  getSignedImageUrl: (...args: unknown[]) => mockGetSignedImageUrl(...args),
  downloadFromR2: (...args: unknown[]) => mockDownloadFromR2(...args),
}));

vi.mock("@/server/services/session", () => ({
  updateSessionStatus: vi.fn(),
}));

vi.mock("@/server/services/platform-validation", () => ({
  validateDeliverable: vi.fn().mockResolvedValue({ valid: true, issues: [] }),
  autoFix: vi.fn().mockImplementation((buf: Buffer) => Promise.resolve(buf)),
}));

vi.mock("@/config/platform-specs", () => ({
  PLATFORM_SPECS: {
    spotify: { name: "Spotify", width: 3000, height: 3000, format: "jpeg", colorSpace: "sRGB", maxFileSizeBytes: 4194304 },
    appleMusic: { name: "Apple", width: 3000, height: 3000, format: "jpeg", colorSpace: "sRGB", maxFileSizeBytes: 4194304 },
    instagramSquare: { name: "IG Square", width: 1080, height: 1080, format: "jpeg", colorSpace: "sRGB", maxFileSizeBytes: 4194304 },
    instagramStory: { name: "IG Story", width: 1080, height: 1920, format: "jpeg", colorSpace: "sRGB", maxFileSizeBytes: 4194304 },
    twitterHeader: { name: "Twitter", width: 1500, height: 500, format: "jpeg", colorSpace: "sRGB", maxFileSizeBytes: 4194304 },
  },
}));

// Mock sharp
vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    toColorspace: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake")),
    metadata: vi.fn().mockResolvedValue({ width: 700, height: 170 }),
  })),
}));

// Mock archiver
const mockAppend = vi.fn();
const mockFinalize = vi.fn().mockResolvedValue(undefined);
vi.mock("archiver", () => ({
  default: vi.fn(() => ({
    append: mockAppend,
    finalize: mockFinalize,
    on: vi.fn((event: string, cb: (data: Buffer) => void) => {
      if (event === "data") {
        // Simulate data emission after finalize
        setTimeout(() => cb(Buffer.from("zip-content")), 0);
      }
    }),
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  sql: { raw: vi.fn() },
}));

describe("createZipBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a signed URL for the created ZIP", async () => {
    mockWhere
      .mockResolvedValueOnce([{ id: "s1", userId: "u1" }])
      .mockResolvedValueOnce([
        { format: "cover-spotify", fileKey: "sessions/s1/package/cover.jpg" },
        { format: "palette", fileKey: "sessions/s1/package/palette.png" },
      ]);

    mockDownloadFromR2.mockResolvedValue(Buffer.from("data"));
    mockUploadImage.mockResolvedValue(undefined);
    mockGetSignedImageUrl.mockResolvedValue("https://signed.example.com/zip");

    const { createZipBundle } = await import("@/server/services/packaging");
    const result = await createZipBundle("s1", "u1");

    expect(result.url).toBe("https://signed.example.com/zip");
    expect(mockDownloadFromR2).toHaveBeenCalledTimes(2);
    expect(mockAppend).toHaveBeenCalledTimes(2);
  });

  it("uses correct filenames in the ZIP", async () => {
    mockWhere
      .mockResolvedValueOnce([{ id: "s1", userId: "u1" }])
      .mockResolvedValueOnce([
        { format: "cover-spotify", fileKey: "k1" },
        { format: "instagram-square", fileKey: "k2" },
        { format: "direction-summary", fileKey: "k3" },
      ]);

    mockDownloadFromR2.mockResolvedValue(Buffer.from("data"));
    mockUploadImage.mockResolvedValue(undefined);
    mockGetSignedImageUrl.mockResolvedValue("https://signed.example.com/zip");

    const { createZipBundle } = await import("@/server/services/packaging");
    await createZipBundle("s1", "u1");

    expect(mockAppend).toHaveBeenCalledWith(expect.any(Buffer), { name: "cover-3000x3000.jpg" });
    expect(mockAppend).toHaveBeenCalledWith(expect.any(Buffer), { name: "instagram-square.jpg" });
    expect(mockAppend).toHaveBeenCalledWith(expect.any(Buffer), { name: "direction-summary.json" });
  });

  it("throws when session does not belong to user", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { createZipBundle } = await import("@/server/services/packaging");
    await expect(createZipBundle("s-bad", "u1")).rejects.toThrow("Session not found");
  });
});
