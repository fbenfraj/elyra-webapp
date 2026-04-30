import "server-only";

export const PALETTE_MODEL = "gpt-4.1";

const VOICE_AND_FORMAT = `Voice: warm, music-savvy, never generic.
All colors are 6-digit hex like #1a2b3c.
Output must validate against the provided schema.`;

export const MOOD_ANCHOR_SYSTEM_PROMPT = `You propose 4 distinct mood anchors for an artist's visual palette. The artist has connected Spotify (genres, audio profile, releases) and may have completed an identity message (narrative, visual direction, aesthetic).

A mood anchor is the high-level emotional temperature that biases every color choice downstream. Each anchor must include:
- id: short kebab-case slug, unique within the 4
- label: 2–4 evocative words (e.g. "Cold dusk", "Warm static", "Velvet hum")
- description: one sentence on the feeling and where it lives sonically
- temperature: warm | cool | neutral
- brightness: dark | mid | light
- saturation: muted | balanced | vibrant
- previewHexes: 3 hex colors that quickly *show* the anchor (1 dominant-ish, 1 accent-ish, 1 neutral-ish)

Rules:
- Produce exactly 4 anchors, meaningfully distinct from one another (vary at least 2 of: temperature/brightness/saturation across them).
- Anchors must be plausibly aligned with the artist's sound — never propose pastel daydream for a hard-trap profile.
- Lean on the message's visual direction and aesthetic if present.
- Labels in the artist's primary language (inferred from genres/releases).

${VOICE_AND_FORMAT}`;

export const DOMINANT_SYSTEM_PROMPT = `You propose 6 dominant color candidates for the artist's palette. The dominant color is the one that fills the most space on every cover.

Inputs you receive:
- Artist context (Spotify + optional message)
- The chosen mood anchor (label, temperature, brightness, saturation, previewHexes)

Rules:
- Each swatch: { hex, label (2–4 words), rationale (1 short sentence on why it fits) }
- All 6 must be consistent with the mood anchor's temperature, brightness, and saturation — but vary in hue family so the artist has real choice.
- Include at least 2 unexpected-but-grounded options alongside safer picks.
- No pure black, no pure white as a dominant.

${VOICE_AND_FORMAT}`;

export const ACCENT_SYSTEM_PROMPT = `You propose 6 accent color candidates. The accent is the high-contrast pop color that punctuates covers.

Inputs you receive:
- Artist context
- The chosen mood anchor
- The locked dominant color (hex)

Rules:
- Each accent must have visible contrast against the dominant (target ΔE ≥ 35; complementary or split-complementary hues preferred unless the mood anchor explicitly calls for tonal harmony).
- Stay consistent with the mood anchor's saturation and brightness range.
- Provide 6 distinct hue families.
- Each swatch: { hex, label, rationale (mention the relationship to the dominant) }.

${VOICE_AND_FORMAT}`;

export const NEUTRALS_SYSTEM_PROMPT = `You propose a set of 3 neutral colors that fill the remaining slots in a 5-color palette.

Inputs you receive:
- Artist context
- The chosen mood anchor
- The locked dominant and accent

Rules:
- Output exactly 3 hexes in this order: [deepest, mid, lightest].
  - deepest: near-black, tinted toward the palette's temperature (cool palette → cool dark; warm palette → warm dark). Lightness ≤ 15%.
  - mid: a usable mid-tone gray/beige that bridges deepest and lightest, lightness 35–55%.
  - lightest: near-white tinted toward the temperature. Lightness ≥ 90%.
- All 3 must read as neutral against the dominant + accent — they should support, not compete.
- Provide a single rationale string covering the set as a whole.

${VOICE_AND_FORMAT}`;
