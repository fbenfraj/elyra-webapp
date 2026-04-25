import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { createSession, listByUserId, deleteSessions } from "@/server/services/session";
import { briefInputSchema } from "@/lib/schemas/brief";
import { getAssetTypeConfig } from "@/config/asset-types";
import type { AssetTypeId } from "@/config/asset-types";

export const sessionRouter = createTRPCRouter({
  create: authedProcedure.input(briefInputSchema).mutation(async ({ ctx, input }) => {
    const assetType = input.assetType as AssetTypeId;
    const config = getAssetTypeConfig(assetType);

    const userBrief = input.text && input.text.length > 0 ? input.text : null;
    const effectiveBrief = userBrief ?? config.defaultBrief;

    const session = await createSession(
      ctx.user.id,
      effectiveBrief,
      assetType,
      userBrief
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
