import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import * as metrics from "@/server/services/metrics";
import * as sessionReview from "@/server/services/session-review";
import * as providerHealth from "@/server/services/provider-health";

const OPERATOR_USER_IDS = process.env.OPERATOR_USER_IDS?.split(",") ?? [];

const operatorProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (!OPERATOR_USER_IDS.includes(ctx.user.id)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Operator access required",
    });
  }
  return next({ ctx });
});

const dateRangeInput = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .optional();

function parseDateRange(input?: { from?: Date; to?: Date }) {
  if (!input?.from) return undefined;
  return {
    from: input.from,
    to: input.to ?? new Date(),
  };
}

export const operatorRouter = createTRPCRouter({
  getPipelineMetrics: operatorProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const range = parseDateRange(input);
      const [hitRate, successRate, avgCost, avgLatency, evalDist] =
        await Promise.all([
          metrics.getHitRate(range),
          metrics.getGenerationSuccessRate(range),
          metrics.getAverageCostPerDeliverable(range),
          metrics.getAverageLatency(range),
          metrics.getEvalScoreDistribution(range),
        ]);
      return {
        hitRate,
        successRate,
        avgCost,
        avgLatency,
        evalDistribution: evalDist,
      };
    }),

  getSessionCosts: operatorProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const range = parseDateRange(input);
      return metrics.getSessionsWithCosts(range);
    }),

  getSessionCostBreakdown: operatorProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return metrics.getSessionCostBreakdown(input.sessionId);
    }),

  getProblematicSessions: operatorProcedure
    .input(
      z.object({
        filters: z.object({
          zeroHitRate: z.boolean().optional(),
          lowScores: z.boolean().optional(),
          highRetries: z.boolean().optional(),
          vagueBriefs: z.boolean().optional(),
        }),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const range = input.from
        ? { from: input.from, to: input.to ?? new Date() }
        : undefined;
      return sessionReview.getProblematicSessions(input.filters, range);
    }),

  getSessionDetail: operatorProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return sessionReview.getSessionDetail(input.sessionId);
    }),

  getProviderHealth: operatorProcedure.query(async () => {
    return providerHealth.getProviderStatuses();
  }),

  getProviderMetrics: operatorProcedure
    .input(
      z.object({
        provider: z.string(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const range = input.from
        ? { from: input.from, to: input.to ?? new Date() }
        : undefined;
      return providerHealth.getProviderMetrics(input.provider, range);
    }),
});
