import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// --- DB mock tracking ---
let selectCallIndex = 0;
const selectResults: unknown[][] = [];
const insertCalls: { values: unknown }[] = [];

function resetDbMocks() {
  selectCallIndex = 0;
  selectResults.length = 0;
  insertCalls.length = 0;
}

function addSelectResult(rows: unknown[]) {
  selectResults.push(rows);
}

function buildSelectChain() {
  const idx = selectCallIndex++;
  const terminal = () => Promise.resolve(selectResults[idx] ?? []);
  const chainable: Record<string, unknown> = {};
  const whereResult = {
    orderBy: () => ({
      limit: () => terminal(),
      then: (resolve: (v: unknown) => void) => terminal().then(resolve),
    }),
    then: (resolve: (v: unknown) => void) => terminal().then(resolve),
    catch: (reject: (v: unknown) => void) => terminal().catch(reject),
  };
  chainable.from = () => chainable;
  chainable.where = () => whereResult;
  return chainable;
}

vi.mock("@/server/db", () => ({
  db: {
    select: () => buildSelectChain(),
    insert: () => ({
      values: (vals: unknown) => {
        insertCalls.push({ values: vals });
        return Promise.resolve();
      },
    }),
  },
}));

vi.mock("@/server/db/schema/sessions", () => ({
  sessions: {
    id: "id",
    userId: "user_id",
    status: "status",
    selectedDirectionId: "selected_direction_id",
    selectedGenerationJobId: "selected_generation_job_id",
  },
}));

vi.mock("@/server/db/schema/generation-attempts", () => ({
  generationAttempts: {
    id: "id",
    sessionId: "session_id",
    imageKey: "image_key",
    generationJobId: "generation_job_id",
    selected: "selected",
  },
}));

vi.mock("@/server/db/schema/generation-jobs", () => ({
  generationJobs: {
    id: "id",
    directionData: "direction_data",
  },
}));

vi.mock("@/server/db/schema/deliverables", () => ({
  deliverables: {},
}));

// Mock storage
const mockUploadImage = vi.fn().mockResolvedValue(undefined);
const mockGetSignedImageUrl = vi.fn().mockResolvedValue("https://signed-url.example.com/image.webp");

const mockDownloadFromR2 = vi.fn().mockResolvedValue(Buffer.alloc(1024));
vi.mock("@/server/services/storage", () => ({
  uploadImage: (...args: unknown[]) => mockUploadImage(...args),
  getSignedImageUrl: (...args: unknown[]) => mockGetSignedImageUrl(...args),
  downloadFromR2: (...args: unknown[]) => mockDownloadFromR2(...args),
}));

const mockUpdateSessionStatus = vi.fn().mockResolvedValue(undefined);
const mockFailSession = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/services/session", () => ({
  updateSessionStatus: (...args: unknown[]) => mockUpdateSessionStatus(...args),
  failSession: (...args: unknown[]) => mockFailSession(...args),
}));

// Mock platform-validation
const mockValidateDeliverable = vi.fn().mockResolvedValue({ valid: true, issues: [] });
const mockAutoFix = vi.fn().mockImplementation((buf: Buffer) => Promise.resolve(buf));
vi.mock("@/server/services/platform-validation", () => ({
  validateDeliverable: (...args: unknown[]) => mockValidateDeliverable(...args),
  autoFix: (...args: unknown[]) => mockAutoFix(...args),
}));

// Mock sharp
const mockSharpToBuffer = vi.fn().mockResolvedValue(Buffer.alloc(1024));
const mockSharpMetadata = vi.fn().mockResolvedValue({ width: 700, height: 170 });
const mockSharpInstance = {
  resize: vi.fn().mockReturnThis(),
  toColorspace: vi.fn().mockReturnThis(),
  jpeg: vi.fn().mockReturnThis(),
  png: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  toBuffer: mockSharpToBuffer,
  metadata: mockSharpMetadata,
};

vi.mock("sharp", () => ({
  default: vi.fn(() => mockSharpInstance),
}));

vi.mock("@/config/platform-specs", () => ({
  PLATFORM_SPECS: {
    spotify: {
      name: "Spotify",
      width: 3000,
      height: 3000,
      format: "jpeg",
      colorSpace: "sRGB",
      maxFileSizeBytes: 4 * 1024 * 1024,
    },
    appleMusic: {
      name: "Apple Music",
      width: 3000,
      height: 3000,
      format: "jpeg",
      colorSpace: "sRGB",
      maxFileSizeBytes: 4 * 1024 * 1024,
    },
    instagramSquare: {
      name: "Instagram Square",
      width: 1080,
      height: 1080,
      format: "jpeg",
      colorSpace: "sRGB",
      maxFileSizeBytes: 4 * 1024 * 1024,
    },
    instagramStory: {
      name: "Instagram Story",
      width: 1080,
      height: 1920,
      format: "jpeg",
      colorSpace: "sRGB",
      maxFileSizeBytes: 4 * 1024 * 1024,
    },
    twitterHeader: {
      name: "Twitter Header",
      width: 1500,
      height: 500,
      format: "jpeg",
      colorSpace: "sRGB",
      maxFileSizeBytes: 4 * 1024 * 1024,
    },
  },
}));

// Mock fetch for downloading source image
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
});
vi.stubGlobal("fetch", mockFetch);

const DIRECTION_DATA = {
  directions: [
    {
      id: "dir-1",
      heroImageKey: "hero.webp",
      moodLabel: "Dark Cinematic",
      tags: ["cinematic", "urban"],
      supportingImageKeys: [],
      colorPalette: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#533483"],
      description: "A moody urban nightscape",
    },
  ],
};

describe("assemblePackage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    mockUpdateSessionStatus.mockResolvedValue(undefined);
    mockUploadImage.mockResolvedValue(undefined);
    mockSharpToBuffer.mockResolvedValue(Buffer.alloc(1024));
    mockSharpMetadata.mockResolvedValue({ width: 700, height: 170 });
    mockValidateDeliverable.mockResolvedValue({ valid: true, issues: [] });
  });

  it("assembles all 7 deliverable formats", async () => {
    // Session lookup
    addSelectResult([
      {
        id: "s1",
        userId: "user-1",
        status: "packaging",
        selectedDirectionId: "dir-1",
        selectedGenerationJobId: "job-1",
      },
    ]);
    // Selected attempt
    addSelectResult([
      { id: "attempt-1", imageKey: "sessions/s1/attempts/att.webp", generationJobId: "job-1" },
    ]);
    // Generation job
    addSelectResult([{ directionData: DIRECTION_DATA }]);

    const { assemblePackage } = await import("@/server/services/packaging");
    const result = await assemblePackage("s1", "user-1");

    expect(result.ok).toBe(true);
    if (result.ok && result.output) {
      expect(result.output.deliverableCount).toBe(7);
    }

    // 7 deliverables inserted
    expect(insertCalls.length).toBe(1);
    const insertedValues = insertCalls[0]?.values;
    expect(Array.isArray(insertedValues)).toBe(true);
    if (Array.isArray(insertedValues)) {
      expect(insertedValues.length).toBe(7);
    }
  });

  it("stores deliverables rows with correct format fields", async () => {
    addSelectResult([
      {
        id: "s1",
        userId: "user-1",
        status: "packaging",
        selectedDirectionId: "dir-1",
        selectedGenerationJobId: "job-1",
      },
    ]);
    addSelectResult([
      { id: "attempt-1", imageKey: "sessions/s1/attempts/att.webp", generationJobId: "job-1" },
    ]);
    addSelectResult([{ directionData: DIRECTION_DATA }]);

    const { assemblePackage } = await import("@/server/services/packaging");
    await assemblePackage("s1", "user-1");

    const insertedValues = insertCalls[0]?.values as Array<{
      format: string;
      fileKey: string;
      mimeType: string;
    }>;
    const formats = insertedValues.map((v) => v.format);

    expect(formats).toContain("cover-spotify");
    expect(formats).toContain("cover-apple");
    expect(formats).toContain("instagram-square");
    expect(formats).toContain("instagram-story");
    expect(formats).toContain("twitter-header");
    expect(formats).toContain("palette");
    expect(formats).toContain("direction-summary");
  });

  it("updates session status to delivered", async () => {
    addSelectResult([
      {
        id: "s1",
        userId: "user-1",
        status: "packaging",
        selectedDirectionId: "dir-1",
        selectedGenerationJobId: "job-1",
      },
    ]);
    addSelectResult([
      { id: "attempt-1", imageKey: "sessions/s1/attempts/att.webp", generationJobId: "job-1" },
    ]);
    addSelectResult([{ directionData: DIRECTION_DATA }]);

    const { assemblePackage } = await import("@/server/services/packaging");
    await assemblePackage("s1", "user-1");

    expect(mockUpdateSessionStatus).toHaveBeenCalledWith("s1", "delivered");
  });

  it("uploads to R2 with correct key pattern", async () => {
    addSelectResult([
      {
        id: "s1",
        userId: "user-1",
        status: "packaging",
        selectedDirectionId: "dir-1",
        selectedGenerationJobId: "job-1",
      },
    ]);
    addSelectResult([
      { id: "attempt-1", imageKey: "sessions/s1/attempts/att.webp", generationJobId: "job-1" },
    ]);
    addSelectResult([{ directionData: DIRECTION_DATA }]);

    const { assemblePackage } = await import("@/server/services/packaging");
    await assemblePackage("s1", "user-1");

    const uploadKeys = mockUploadImage.mock.calls.map(
      (call: unknown[]) => call[0]
    );
    expect(uploadKeys).toContain("sessions/s1/package/cover-spotify.jpg");
    expect(uploadKeys).toContain("sessions/s1/package/cover-apple.jpg");
    expect(uploadKeys).toContain("sessions/s1/package/instagram-square.jpg");
    expect(uploadKeys).toContain("sessions/s1/package/instagram-story.jpg");
    expect(uploadKeys).toContain("sessions/s1/package/twitter-header.jpg");
    expect(uploadKeys).toContain("sessions/s1/package/palette.png");
    expect(uploadKeys).toContain("sessions/s1/package/direction-summary.json");
  });

  it("rejects when session not found", async () => {
    addSelectResult([]);

    const { assemblePackage } = await import("@/server/services/packaging");
    const result = await assemblePackage("s1", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok && result.error) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("rejects when session is not in packaging phase", async () => {
    addSelectResult([
      {
        id: "s1",
        userId: "user-1",
        status: "selecting",
        selectedDirectionId: "dir-1",
        selectedGenerationJobId: "job-1",
      },
    ]);

    const { assemblePackage } = await import("@/server/services/packaging");
    const result = await assemblePackage("s1", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok && result.error) {
      expect(result.error.code).toBe("INVALID_STATUS");
    }
  });

  it("rejects when no image is selected", async () => {
    addSelectResult([
      {
        id: "s1",
        userId: "user-1",
        status: "packaging",
        selectedDirectionId: "dir-1",
        selectedGenerationJobId: "job-1",
      },
    ]);
    addSelectResult([]); // No selected attempt

    const { assemblePackage } = await import("@/server/services/packaging");
    const result = await assemblePackage("s1", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok && result.error) {
      expect(result.error.code).toBe("NO_SELECTION");
    }
  });

  it("direction summary includes correct fields", async () => {
    addSelectResult([
      {
        id: "s1",
        userId: "user-1",
        status: "packaging",
        selectedDirectionId: "dir-1",
        selectedGenerationJobId: "job-1",
      },
    ]);
    addSelectResult([
      { id: "attempt-1", imageKey: "sessions/s1/attempts/att.webp", generationJobId: "job-1" },
    ]);
    addSelectResult([{ directionData: DIRECTION_DATA }]);

    const { assemblePackage } = await import("@/server/services/packaging");
    await assemblePackage("s1", "user-1");

    // Find the direction-summary upload call
    const summaryCall = mockUploadImage.mock.calls.find(
      (call: unknown[]) => call[0] === "sessions/s1/package/direction-summary.json"
    );
    expect(summaryCall).toBeTruthy();

    const summaryBuffer = summaryCall![1] as Buffer;
    const summary = JSON.parse(summaryBuffer.toString("utf-8"));

    expect(summary.moodLabel).toBe("Dark Cinematic");
    expect(summary.description).toBe("A moody urban nightscape");
    expect(summary.palette).toHaveLength(5);
    expect(summary.tags).toEqual(["cinematic", "urban"]);
  });
});
