// apps/web/src/config/asset-types.ts

export const ASSET_TYPES = {
  release_artwork: {
    id: "release_artwork" as const,
    label: "Release Artwork",
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
    promptSuffix:
      "Album cover art, square format, high quality, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for a release artwork (square album/single/EP cover). Focus on symbolic imagery, bold composition, and iconic visual identity.",
    placeholder: "Describe the mood, colors, and imagery for your artwork...",
    defaultBrief:
      "Create a high-quality release artwork consistent with the artist's visual identity and recent work",
  },
  instagram_post: {
    id: "instagram_post" as const,
    label: "Instagram Post",
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
    promptSuffix:
      "Social media visual, square format, high quality, visually striking, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for an Instagram post (square social media visual). Focus on eye-catching, scroll-stopping imagery that works at small sizes. Bold colors, clear focal point, strong mood.",
    placeholder: "What's the vibe for this post?",
    defaultBrief:
      "Create a high-quality Instagram post consistent with the artist's visual identity and recent work",
  },
  instagram_story: {
    id: "instagram_story" as const,
    label: "Instagram Story",
    aspectRatio: "9:16",
    width: 768,
    height: 1344,
    promptSuffix:
      "Vertical visual, full-bleed, mobile-first, immersive, high quality, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for an Instagram story (9:16 vertical, full-screen mobile). Focus on immersive, atmospheric imagery that fills a vertical frame. Strong verticality in composition.",
    placeholder: "Describe the visual feel for your story...",
    defaultBrief:
      "Create a high-quality Instagram story visual consistent with the artist's visual identity and recent work",
  },
  announcement: {
    id: "announcement" as const,
    label: "Announcement",
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
    promptSuffix:
      "Promotional announcement visual, bold and eye-catching, square format, high quality, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for an announcement/promo post (square). Focus on bold, attention-grabbing imagery that conveys excitement or importance. High energy, dramatic lighting or composition.",
    placeholder: "What are you announcing? Describe the visual tone...",
    defaultBrief:
      "Create a bold, eye-catching announcement visual consistent with the artist's visual identity",
  },
  artist_portrait: {
    id: "artist_portrait" as const,
    label: "Artist Portrait",
    aspectRatio: "2:3",
    width: 896,
    height: 1344,
    promptSuffix:
      "Artist portrait, editorial photography style, 2:3 vertical format, high quality, cinematic lighting, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for an artist portrait (2:3 vertical, editorial photography style). Focus on identity, presence, and mood. Consider setting, lighting, posture, and atmosphere that reflects the artist's persona.",
    placeholder: "Describe the setting, mood, and style for your portrait...",
    defaultBrief:
      "Create a high-quality artist portrait consistent with the artist's visual identity and persona",
  },
} as const;

export type AssetTypeId = keyof typeof ASSET_TYPES;

export const ASSET_TYPE_IDS = Object.keys(ASSET_TYPES) as AssetTypeId[];

export function getAssetTypeConfig(id: AssetTypeId) {
  return ASSET_TYPES[id];
}
