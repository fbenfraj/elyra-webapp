import "server-only";

import { z } from "zod/v4";
import { createTRPCRouter, authedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  listUserReferences,
  canUpload,
  createUserReference,
  deleteUserReference,
} from "@/server/services/user-references";
import { createPresignedUploadUrl } from "@/server/services/storage";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const referenceRouter = createTRPCRouter({
  list: authedProcedure.query(async ({ ctx }) => {
    return listUserReferences(ctx.user.id);
  }),

  createUploadUrl: authedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(255),
        contentType: z.string(),
        fileSize: z.number().int().min(1).max(MAX_FILE_SIZE),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_CONTENT_TYPES.includes(input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported file type. Use JPEG, PNG, or WebP.",
        });
      }

      const allowed = await canUpload(ctx.user.id, 1);
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Reference library limit reached (max 50).",
        });
      }

      const ext = input.contentType.split("/")[1] ?? "jpeg";
      const uuid = crypto.randomUUID();
      const r2Key = `user-references/${ctx.user.id}/${uuid}.${ext}`;

      const uploadUrl = await createPresignedUploadUrl(r2Key, input.contentType);

      return { uploadUrl, r2Key };
    }),

  confirmUpload: authedProcedure
    .input(
      z.object({
        r2Key: z.string().min(1),
        width: z.number().int().min(1),
        height: z.number().int().min(1),
        filename: z.string().min(1).max(255),
        fileSize: z.number().int().min(1).max(MAX_FILE_SIZE),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate r2Key belongs to this user
      const expectedPrefix = `user-references/${ctx.user.id}/`;
      if (!input.r2Key.startsWith(expectedPrefix)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid upload key.",
        });
      }

      const ref = await createUserReference(ctx.user.id, {
        source: "upload",
        r2Key: input.r2Key,
        originalFilename: input.filename,
        width: input.width,
        height: input.height,
        fileSizeBytes: input.fileSize,
      });

      return { id: ref.id };
    }),

  delete: authedProcedure
    .input(z.object({ referenceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteUserReference(ctx.user.id, input.referenceId);
        return { ok: true };
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reference not found",
        });
      }
    }),
});
