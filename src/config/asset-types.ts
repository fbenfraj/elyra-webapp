// apps/web/src/config/asset-types.ts

export type AssetCategory = "cover_art" | "social" | "promotional" | "artist";

export type AssetTypeConfig = {
  id: string;
  label: string;
  category: AssetCategory;
  aspectRatio: string;
  width: number;
  height: number;
  promptSuffix: string;
  interpretationContext: string;
  placeholder: string;
  defaultBrief: string;
  /** Hidden from format selector UI — kept for backward compat only */
  hidden?: boolean;
};

export const ASSET_CATEGORIES: Record<AssetCategory, { label: string; order: number }> = {
  cover_art: { label: "Cover Art", order: 0 },
  social: { label: "Social", order: 1 },
  promotional: { label: "Promotional", order: 2 },
  artist: { label: "Artist", order: 3 },
};

export const ASSET_TYPES = {
  // --- Legacy (hidden from UI, kept for existing sessions) ---
  release_artwork: {
    id: "release_artwork" as const,
    label: "Release Artwork",
    category: "cover_art" as const,
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
    hidden: true,
  },

  // --- Cover Art ---
  album_cover: {
    id: "album_cover" as const,
    label: "Album Cover",
    category: "cover_art" as const,
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
    promptSuffix:
      "Album cover art, square format, iconic and symbolic, high quality, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for an album cover (square, 1:1). This represents a full body of work — think iconic, symbolic, conceptual. Emphasis on a single bold visual statement with layered meaning and artistic ambition. Classic album art energy.",
    placeholder: "What's this album about?",
    defaultBrief:
      "Create an iconic album cover consistent with the artist's visual identity — symbolic, conceptual, representing a full body of work",
  },
  single_cover: {
    id: "single_cover" as const,
    label: "Single Cover",
    category: "cover_art" as const,
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
    promptSuffix:
      "Single cover art, square format, punchy and immediate, high quality, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for a single cover (square, 1:1). This captures the energy of one track — punchy, immediate, mood-driven. Simpler composition than album art, stronger emotional hit, more raw and direct.",
    placeholder: "What's this single about?",
    defaultBrief:
      "Create a punchy single cover consistent with the artist's visual identity — immediate, mood-driven, capturing the energy of one track",
  },
  ep_cover: {
    id: "ep_cover" as const,
    label: "EP Cover",
    category: "cover_art" as const,
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
    promptSuffix:
      "EP cover art, square format, cohesive yet exploratory, high quality, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for an EP cover (square, 1:1). Between album and single — cohesive but exploratory. Can be more abstract or experimental. Represents a short collection, not a definitive statement.",
    placeholder: "What's this EP about?",
    defaultBrief:
      "Create an EP cover consistent with the artist's visual identity — cohesive yet exploratory, representing a short collection",
  },

  // --- Social ---
  instagram_post: {
    id: "instagram_post" as const,
    label: "Instagram Post",
    category: "social" as const,
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
    category: "social" as const,
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

  // --- Promotional ---
  announcement: {
    id: "announcement" as const,
    label: "Announcement",
    category: "promotional" as const,
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

  // --- Artist ---
  artist_portrait: {
    id: "artist_portrait" as const,
    label: "Artist Portrait",
    category: "artist" as const,
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
  press_photo: {
    id: "press_photo" as const,
    label: "Press Photo",
    category: "artist" as const,
    aspectRatio: "3:2",
    width: 1344,
    height: 896,
    promptSuffix:
      "Press photo, landscape format, editorial quality, professional lighting, high quality, no text, no words, no letters, no watermarks, no logos.",
    interpretationContext:
      "You are interpreting a brief for a press photo (3:2 landscape, editorial). Professional, versatile imagery suitable for media outlets, websites, and press kits. Clean composition with space for cropping.",
    placeholder: "Describe the feel for your press photo...",
    defaultBrief:
      "Create a professional press photo consistent with the artist's visual identity — editorial quality, versatile for media use",
  },
} as const;

export type AssetTypeId = keyof typeof ASSET_TYPES;

/** All asset type IDs including hidden/legacy ones */
export const ASSET_TYPE_IDS = Object.keys(ASSET_TYPES) as AssetTypeId[];

/** Only asset type IDs visible in the format selector UI */
export const SELECTABLE_ASSET_TYPE_IDS = (
  Object.entries(ASSET_TYPES) as [AssetTypeId, AssetTypeConfig][]
)
  .filter(([, config]) => !config.hidden)
  .map(([id]) => id);

export function getAssetTypeConfig(id: AssetTypeId): AssetTypeConfig {
  return ASSET_TYPES[id];
}
