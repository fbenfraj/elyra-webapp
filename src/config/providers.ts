import "server-only";

export const INTERPRETATION_MODEL = "gpt-4.1" as const;

export const INTERPRETATION_FALLBACK_MODEL = "gpt-4o" as const;

export const MODERATION_CATEGORIES_BLOCKED = [
  "violence",
  "sexual",
  "self-harm",
  "illicit",
] as const;
