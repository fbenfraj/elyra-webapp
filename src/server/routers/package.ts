import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { deliverables } from "@/server/db/schema/deliverables";
import { eq, and } from "drizzle-orm";
import { getSignedImageUrl } from "@/server/services/storage";
import { createZipBundle } from "@/server/services/packaging";
import { createShareLinkForSession } from "@/server/services/sharing";
import { TRPCError } from "@trpc/server";

export const packageRouter = createTRPCRouter({
  get: authedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Verify session belongs to user
      const [session] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, input.sessionId),
            eq(sessions.userId, ctx.user.id)
          )
        );

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      // Load deliverables for the session
      const rows = await db
        .select({
          id: deliverables.id,
          format: deliverables.format,
          fileKey: deliverables.fileKey,
          fileSizeBytes: deliverables.fileSizeBytes,
          width: deliverables.width,
          height: deliverables.height,
          mimeType: deliverables.mimeType,
        })
        .from(deliverables)
        .where(eq(deliverables.sessionId, input.sessionId));

      // Generate signed URLs for each deliverable
      const withUrls = await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          format: row.format,
          url: await getSignedImageUrl(row.fileKey),
          fileSizeBytes: row.fileSizeBytes,
          width: row.width,
          height: row.height,
          mimeType: row.mimeType,
        }))
      );

      return { deliverables: withUrls };
    }),

  downloadBundle: authedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createZipBundle(input.sessionId, ctx.user.id);
        return { url: result.url };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create download bundle";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  createShareLink: authedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createShareLinkForSession(
          input.sessionId,
          ctx.user.id
        );
        return { shareUrl: result.shareUrl };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create share link";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
});
