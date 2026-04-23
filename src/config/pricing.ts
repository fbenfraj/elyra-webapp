export const PACK_PRICE_CENTS = 700;
export const PACK_PRICE_DISPLAY = "EUR 7";
export const PACK_CURRENCY = "eur";
export const PACK_REGEN_LIMIT = 3;

export const PACK_INCLUDES = [
  "Cover art (Spotify & Apple Music ready)",
  "Social formats (Instagram, Twitter)",
  "Color palette",
  "Direction summary",
] as const;

export const packConfig = {
  priceCents: PACK_PRICE_CENTS,
  priceDisplay: PACK_PRICE_DISPLAY,
  currency: PACK_CURRENCY,
  regenLimit: PACK_REGEN_LIMIT,
  includes: PACK_INCLUDES,
} as const;
