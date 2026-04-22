import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { sessionRouter } from "@/server/routers/session";
import { generationRouter } from "@/server/routers/generation";

export const appRouter = createTRPCRouter({
  session: sessionRouter,
  generation: generationRouter,
});

export type AppRouter = typeof appRouter;
