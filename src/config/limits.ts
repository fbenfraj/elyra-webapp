/** Session and usage limits. */

export const MAX_SESSION_COST_CENTS = 200;
/** Reserved for future rate-limiting enforcement — not yet wired into a service. */
export const MAX_USER_DAILY_SESSIONS = 10;
export const MAX_USER_DAILY_COST_CENTS = 500; // $5/day per user

export const ALERT_THRESHOLDS = {
  minHitRatePercent: 60,
  maxAvgCostCentsPerDeliverable: 50,
  maxProviderFailureRatePercent: 10,
} as const;
