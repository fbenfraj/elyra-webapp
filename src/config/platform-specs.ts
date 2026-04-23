/**
 * Platform-specific image specifications for release pack delivery.
 * Each spec defines the output format required by major music/social platforms.
 */

export type PlatformSpec = {
  name: string;
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp";
  colorSpace: "sRGB" | "P3";
  maxFileSizeBytes: number;
};

export const PLATFORM_SPECS = {
  spotify: {
    name: "Spotify",
    width: 3000,
    height: 3000,
    format: "jpeg",
    colorSpace: "sRGB",
    maxFileSizeBytes: 4 * 1024 * 1024, // 4 MB
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
} as const satisfies Record<string, PlatformSpec>;
