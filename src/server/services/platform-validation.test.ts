import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Mock sharp
const mockMetadata = vi.fn();
const mockResize = vi.fn();
const mockToColorspace = vi.fn();
const mockJpeg = vi.fn();
const mockPng = vi.fn();
const mockWebp = vi.fn();
const mockToBuffer = vi.fn();

const mockSharpInstance = {
  metadata: mockMetadata,
  resize: mockResize,
  toColorspace: mockToColorspace,
  jpeg: mockJpeg,
  png: mockPng,
  webp: mockWebp,
  toBuffer: mockToBuffer,
};

// Each method returns the instance for chaining
mockResize.mockReturnValue(mockSharpInstance);
mockToColorspace.mockReturnValue(mockSharpInstance);
mockJpeg.mockReturnValue(mockSharpInstance);
mockPng.mockReturnValue(mockSharpInstance);
mockWebp.mockReturnValue(mockSharpInstance);

vi.mock("sharp", () => ({
  default: vi.fn(() => mockSharpInstance),
}));

import type { PlatformSpec } from "@/config/platform-specs";

const spotifySpec: PlatformSpec = {
  name: "Spotify",
  width: 3000,
  height: 3000,
  format: "jpeg",
  colorSpace: "sRGB",
  maxFileSizeBytes: 4 * 1024 * 1024,
};

describe("validateDeliverable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResize.mockReturnValue(mockSharpInstance);
    mockToColorspace.mockReturnValue(mockSharpInstance);
    mockJpeg.mockReturnValue(mockSharpInstance);
    mockPng.mockReturnValue(mockSharpInstance);
    mockWebp.mockReturnValue(mockSharpInstance);
  });

  it("validates correct image passes", async () => {
    mockMetadata.mockResolvedValue({
      width: 3000,
      height: 3000,
      format: "jpeg",
    });

    const { validateDeliverable } = await import(
      "@/server/services/platform-validation"
    );

    // Buffer smaller than 4MB
    const buffer = Buffer.alloc(1024 * 1024); // 1MB
    const result = await validateDeliverable(buffer, spotifySpec);

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects oversized image", async () => {
    mockMetadata.mockResolvedValue({
      width: 3000,
      height: 3000,
      format: "jpeg",
    });

    const { validateDeliverable } = await import(
      "@/server/services/platform-validation"
    );

    // Buffer larger than 4MB
    const buffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
    const result = await validateDeliverable(buffer, spotifySpec);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "fileSize")).toBe(true);
  });

  it("rejects wrong dimensions", async () => {
    mockMetadata.mockResolvedValue({
      width: 1080,
      height: 1080,
      format: "jpeg",
    });

    const { validateDeliverable } = await import(
      "@/server/services/platform-validation"
    );

    const buffer = Buffer.alloc(1024);
    const result = await validateDeliverable(buffer, spotifySpec);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "width")).toBe(true);
    expect(result.issues.some((i) => i.field === "height")).toBe(true);
  });

  it("rejects wrong format", async () => {
    mockMetadata.mockResolvedValue({
      width: 3000,
      height: 3000,
      format: "png",
    });

    const { validateDeliverable } = await import(
      "@/server/services/platform-validation"
    );

    const buffer = Buffer.alloc(1024);
    const result = await validateDeliverable(buffer, spotifySpec);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === "format")).toBe(true);
  });
});

describe("autoFix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResize.mockReturnValue(mockSharpInstance);
    mockToColorspace.mockReturnValue(mockSharpInstance);
    mockJpeg.mockReturnValue(mockSharpInstance);
    mockPng.mockReturnValue(mockSharpInstance);
    mockWebp.mockReturnValue(mockSharpInstance);
  });

  it("autoFix reduces file size below limit", async () => {
    // First call returns large buffer, second returns small buffer
    const smallBuffer = Buffer.alloc(1024 * 1024); // 1MB
    mockToBuffer.mockResolvedValue(smallBuffer);

    const { autoFix } = await import("@/server/services/platform-validation");

    const buffer = Buffer.alloc(5 * 1024 * 1024); // 5MB input
    const result = await autoFix(buffer, spotifySpec);

    expect(result.length).toBeLessThanOrEqual(spotifySpec.maxFileSizeBytes);
    expect(mockResize).toHaveBeenCalledWith(3000, 3000, {
      fit: "cover",
      position: "center",
    });
  });

  it("autoFix applies correct format for JPEG specs", async () => {
    const outputBuffer = Buffer.alloc(1024);
    mockToBuffer.mockResolvedValue(outputBuffer);

    const { autoFix } = await import("@/server/services/platform-validation");

    await autoFix(Buffer.alloc(1024), spotifySpec);

    expect(mockJpeg).toHaveBeenCalled();
    expect(mockToColorspace).toHaveBeenCalledWith("srgb");
  });

  it("autoFix retries with lower quality if still too large", async () => {
    // First toBuffer returns large, second returns small
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024);
    const smallBuffer = Buffer.alloc(1024 * 1024);
    mockToBuffer
      .mockResolvedValueOnce(largeBuffer)
      .mockResolvedValueOnce(smallBuffer);

    const { autoFix } = await import("@/server/services/platform-validation");

    const result = await autoFix(Buffer.alloc(5 * 1024 * 1024), spotifySpec);

    // Should have called jpeg twice (once at 85, once at 70)
    expect(mockJpeg).toHaveBeenCalledTimes(2);
    expect(result).toBe(smallBuffer);
  });
});
