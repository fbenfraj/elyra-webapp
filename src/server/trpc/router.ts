import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { sessionRouter } from "@/server/routers/session";
import { generationRouter } from "@/server/routers/generation";
import { paymentRouter } from "@/server/routers/payment";
import { packageRouter } from "@/server/routers/package";
import { feedbackRouter } from "@/server/routers/feedback";
import { operatorRouter } from "@/server/routers/operator";
import { libraryRouter } from "@/server/routers/library";

export const appRouter = createTRPCRouter({
  session: sessionRouter,
  generation: generationRouter,
  payment: paymentRouter,
  package: packageRouter,
  feedback: feedbackRouter,
  operator: operatorRouter,
  library: libraryRouter,
});

export type AppRouter = typeof appRouter;
