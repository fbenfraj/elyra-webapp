import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { createSession, listByUserId, deleteSessions } from "@/server/services/session";
import { briefInputSchema } from "@/lib/schemas/brief";
import { getAssetTypeConfig } from "@/config/asset-types";
import type { AssetTypeId } from "@/config/asset-types";
import { validateOwnership } from "@/server/services/user-references";
import { TRPCError } from "@trpc/server";

export const sessionRouter = createTRPCRouter({
  create: authedProcedure.input(briefInputSchema).mutation(async ({ ctx, input }) => {
    const assetType = input.assetType as AssetTypeId;
    const config = getAssetTypeConfig(assetType);

    const userBrief = input.text && input.text.length > 0 ? input.text : null;
    const effectiveBrief = userBrief ?? config.defaultBrief;

    // Validate reference ownership
    if (input.referenceIds && input.referenceIds.length > 0) {
      const owned = await validateOwnership(ctx.user.id, input.referenceIds);
      if (!owned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "One or more references do not belong to your account.",
        });
      }
    }

    const session = await createSession(
      ctx.user.id,
      effectiveBrief,
      assetType,
      userBrief,
      undefined,
      input.referenceIds
    );
    return { id: session.id };
  }),

  list: authedProcedure.query(async ({ ctx }) => {
    return listByUserId(ctx.user.id);
  }),

  delete: authedProcedure
    .input(z.object({ sessionIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await deleteSessions(ctx.user.id, input.sessionIds);
      return { deleted: input.sessionIds.length };
    }),
});
