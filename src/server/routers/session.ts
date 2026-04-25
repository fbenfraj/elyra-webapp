import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { createSession, listByUserId, deleteSessions } from "@/server/services/session";
import { briefInputSchema } from "@/lib/schemas/brief";

export const sessionRouter = createTRPCRouter({
  create: authedProcedure.input(briefInputSchema).mutation(async ({ ctx, input }) => {
    const session = await createSession(ctx.user.id, input.text);
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
