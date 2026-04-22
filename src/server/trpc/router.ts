import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";

export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;
