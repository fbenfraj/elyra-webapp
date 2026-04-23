import "server-only";

import * as metrics from "@/server/services/metrics";
import { ALERT_THRESHOLDS } from "@/config/limits";

export async function checkThresholds(): Promise<void> {
  try {
    const last24h = {
      from: new Date(Date.now() - 24 * 60 * 60 * 1000),
      to: new Date(),
    };

    const [hitRate, avgCost] = await Promise.all([
      metrics.getHitRate(last24h),
      metrics.getAverageCostPerDeliverable(last24h),
    ]);

    if (hitRate < ALERT_THRESHOLDS.minHitRatePercent && hitRate > 0) {
      console.error(
        JSON.stringify({
          event: "threshold_breach",
          metric: "hit_rate",
          value: hitRate,
          threshold: ALERT_THRESHOLDS.minHitRatePercent,
          timestamp: new Date().toISOString(),
        })
      );
    }

    if (avgCost > ALERT_THRESHOLDS.maxAvgCostCentsPerDeliverable) {
      console.error(
        JSON.stringify({
          event: "threshold_breach",
          metric: "avg_cost",
          value: avgCost,
          threshold: ALERT_THRESHOLDS.maxAvgCostCentsPerDeliverable,
          timestamp: new Date().toISOString(),
        })
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "threshold_check_failed",
        error: String(error),
      })
    );
  }
}
