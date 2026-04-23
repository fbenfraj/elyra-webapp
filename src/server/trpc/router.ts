import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { sessionRouter } from "@/server/routers/session";
import { generationRouter } from "@/server/routers/generation";
import { paymentRouter } from "@/server/routers/payment";

export const appRouter = createTRPCRouter({
  session: sessionRouter,
  generation: generationRouter,
  payment: paymentRouter,
});

export type AppRouter = typeof appRouter;
