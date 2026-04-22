import "server-only";

import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { createSession, listByUserId } from "@/server/services/session";
import { briefInputSchema } from "@/lib/schemas/brief";

export const sessionRouter = createTRPCRouter({
  create: authedProcedure.input(briefInputSchema).mutation(async ({ ctx, input }) => {
    const session = await createSession(ctx.user.id, input.text);
    return { id: session.id };
  }),

  list: authedProcedure.query(async ({ ctx }) => {
    return listByUserId(ctx.user.id);
  }),
});
