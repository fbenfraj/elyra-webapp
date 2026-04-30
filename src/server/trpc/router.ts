import "server-only";

import { createTRPCRouter } from "@/server/trpc/init";
import { sessionRouter } from "@/server/routers/session";
import { generationRouter } from "@/server/routers/generation";
import { paymentRouter } from "@/server/routers/payment";
import { packageRouter } from "@/server/routers/package";
import { feedbackRouter } from "@/server/routers/feedback";
import { operatorRouter } from "@/server/routers/operator";
import { libraryRouter } from "@/server/routers/library";
import { userRouter } from "@/server/routers/user";
import { referenceRouter } from "@/server/routers/reference";
import { moodboardRouter } from "@/server/routers/moodboard";
import { messageRouter } from "@/server/routers/message";
import { paletteRouter } from "@/server/routers/palette";

export const appRouter = createTRPCRouter({
  session: sessionRouter,
  generation: generationRouter,
  payment: paymentRouter,
  package: packageRouter,
  feedback: feedbackRouter,
  operator: operatorRouter,
  library: libraryRouter,
  user: userRouter,
  reference: referenceRouter,
  moodboard: moodboardRouter,
  message: messageRouter,
  palette: paletteRouter,
});

export type AppRouter = typeof appRouter;
