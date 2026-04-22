import "server-only";

import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { listByUserId } from "@/server/services/session";

export const sessionRouter = createTRPCRouter({
  list: authedProcedure.query(async ({ ctx }) => {
    return listByUserId(ctx.user.id);
  }),
});
