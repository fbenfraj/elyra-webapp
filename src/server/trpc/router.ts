import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { sessionRouter } from "@/server/routers/session";

export const appRouter = createTRPCRouter({
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
