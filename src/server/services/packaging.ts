import "server-only";

import sharp from "sharp";
import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { generationAttempts } from "@/server/db/schema/generation-attempts";
import { generationJobs } from "@/server/db/schema/generation-jobs";
import { deliverables } from "@/server/db/schema/deliverables";
import { eq, and, desc } from "drizzle-orm";
import { uploadImage, getSignedImageUrl, downloadFromR2 } from "@/server/services/storage";
import archiver from "archiver";
import { updateSessionStatus, failSession } from "@/server/services/session";
import { validateDeliverable, autoFix } from "@/server/services/platform-validation";
import { PLATFORM_SPECS } from "@/config/platform-specs";
import type { TaskResult } from "@/types/task";

/** Direction data as stored in generation_jobs.directionData */
type StoredDirection = {
  id: string;
  heroImageKey: string;
  moodLabel: string;
  tags: string[];
  supportingImageKeys: string[];
  colorPalette: string[];
  description: string;
};

type StoredDirectionData = {
  directions: StoredDirection[];
};

type DirectionSummary = {
  moodLabel: string;
  description: string;
  palette: { hex: string; index: number }[];
  tags: string[];
};

type DeliverableInsert = {
  sessionId: string;
  format: string;
  fileKey: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  mimeType: string;
};

const MAX_COVER_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Assembles the full release package for a session.
 *
 * Loads the selected image, generates all platform-specific variants,
 * creates palette and direction summary artifacts, uploads all to R2,
 * stores deliverables rows, and updates session status to delivered.
 */
export async function assemblePackage(
  sessionId: string,
  userId: string
): Promise<TaskResult<{ deliverableCount: number; totalSizeBytes: number }>> {
  const start = Date.now();

  try {
    // Step 1: Validate session ownership and status
    const [session] = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        status: sessions.status,
        selectedDirectionId: sessions.selectedDirectionId,
        selectedGenerationJobId: sessions.selectedGenerationJobId,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!session || session.userId !== userId) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Session not found" },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    if (session.status !== "packaging") {
      return {
        ok: false,
        error: { code: "INVALID_STATUS", message: "Session is not in packaging phase" },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    // Step 2: Load selected image
    const [selectedAttempt] = await db
      .select({
        id: generationAttempts.id,
        imageKey: generationAttempts.imageKey,
        generationJobId: generationAttempts.generationJobId,
      })
      .from(generationAttempts)
      .where(
        and(
          eq(generationAttempts.sessionId, sessionId),
          eq(generationAttempts.selected, true)
        )
      );

    if (!selectedAttempt) {
      return {
        ok: false,
        error: { code: "NO_SELECTION", message: "No image selected for packaging" },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    // Step 3: Load direction data
    const [job] = await db
      .select({ directionData: generationJobs.directionData })
      .from(generationJobs)
      .where(eq(generationJobs.id, selectedAttempt.generationJobId));

    if (!job) {
      return {
        ok: false,
        error: { code: "JOB_NOT_FOUND", message: "Generation job not found" },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    const directionData = job.directionData as StoredDirectionData;
    const direction = directionData.directions.find(
      (d) => d.id === session.selectedDirectionId
    );

    if (!direction) {
      return {
        ok: false,
        error: { code: "DIRECTION_NOT_FOUND", message: "Selected direction not found in job data" },
        meta: { costCents: 0, durationMs: Date.now() - start },
      };
    }

    // Step 4: Download the source image from R2
    const signedUrl = await getSignedImageUrl(selectedAttempt.imageKey);
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch source image: ${response.status}`);
    }
    const sourceBuffer = Buffer.from(await response.arrayBuffer());

    // Step 5: Generate all deliverables
    const deliverableInserts: DeliverableInsert[] = [];
    let totalSizeBytes = 0;

    // 5a: Cover art — Spotify
    const spotifyBuffer = await processForPlatform(sourceBuffer, PLATFORM_SPECS.spotify);
    const spotifyKey = `sessions/${sessionId}/package/cover-spotify.jpg`;
    await uploadImage(spotifyKey, spotifyBuffer, "image/jpeg");
    deliverableInserts.push({
      sessionId,
      format: "cover-spotify",
      fileKey: spotifyKey,
      fileSizeBytes: spotifyBuffer.length,
      width: PLATFORM_SPECS.spotify.width,
      height: PLATFORM_SPECS.spotify.height,
      mimeType: "image/jpeg",
    });
    totalSizeBytes += spotifyBuffer.length;

    // 5b: Cover art — Apple Music
    const appleBuffer = await processForPlatform(sourceBuffer, PLATFORM_SPECS.appleMusic);
    const appleKey = `sessions/${sessionId}/package/cover-apple.jpg`;
    await uploadImage(appleKey, appleBuffer, "image/jpeg");
    deliverableInserts.push({
      sessionId,
      format: "cover-apple",
      fileKey: appleKey,
      fileSizeBytes: appleBuffer.length,
      width: PLATFORM_SPECS.appleMusic.width,
      height: PLATFORM_SPECS.appleMusic.height,
      mimeType: "image/jpeg",
    });
    totalSizeBytes += appleBuffer.length;

    // 5c: Instagram square
    const igSquareBuffer = await processForPlatform(sourceBuffer, PLATFORM_SPECS.instagramSquare);
    const igSquareKey = `sessions/${sessionId}/package/instagram-square.jpg`;
    await uploadImage(igSquareKey, igSquareBuffer, "image/jpeg");
    deliverableInserts.push({
      sessionId,
      format: "instagram-square",
      fileKey: igSquareKey,
      fileSizeBytes: igSquareBuffer.length,
      width: PLATFORM_SPECS.instagramSquare.width,
      height: PLATFORM_SPECS.instagramSquare.height,
      mimeType: "image/jpeg",
    });
    totalSizeBytes += igSquareBuffer.length;

    // 5d: Instagram story
    const igStoryBuffer = await processForPlatform(sourceBuffer, PLATFORM_SPECS.instagramStory);
    const igStoryKey = `sessions/${sessionId}/package/instagram-story.jpg`;
    await uploadImage(igStoryKey, igStoryBuffer, "image/jpeg");
    deliverableInserts.push({
      sessionId,
      format: "instagram-story",
      fileKey: igStoryKey,
      fileSizeBytes: igStoryBuffer.length,
      width: PLATFORM_SPECS.instagramStory.width,
      height: PLATFORM_SPECS.instagramStory.height,
      mimeType: "image/jpeg",
    });
    totalSizeBytes += igStoryBuffer.length;

    // 5e: Twitter header
    const twitterBuffer = await processForPlatform(sourceBuffer, PLATFORM_SPECS.twitterHeader);
    const twitterKey = `sessions/${sessionId}/package/twitter-header.jpg`;
    await uploadImage(twitterKey, twitterBuffer, "image/jpeg");
    deliverableInserts.push({
      sessionId,
      format: "twitter-header",
      fileKey: twitterKey,
      fileSizeBytes: twitterBuffer.length,
      width: PLATFORM_SPECS.twitterHeader.width,
      height: PLATFORM_SPECS.twitterHeader.height,
      mimeType: "image/jpeg",
    });
    totalSizeBytes += twitterBuffer.length;

    // 5f: Palette image
    const paletteColors = direction.colorPalette.slice(0, 5);
    const paletteBuffer = await generatePaletteImage(paletteColors);
    const paletteKey = `sessions/${sessionId}/package/palette.png`;
    await uploadImage(paletteKey, paletteBuffer, "image/png");
    const paletteMeta = await sharp(paletteBuffer).metadata();
    deliverableInserts.push({
      sessionId,
      format: "palette",
      fileKey: paletteKey,
      fileSizeBytes: paletteBuffer.length,
      width: paletteMeta.width ?? null,
      height: paletteMeta.height ?? null,
      mimeType: "image/png",
    });
    totalSizeBytes += paletteBuffer.length;

    // 5g: Direction summary (JSON)
    const summary: DirectionSummary = {
      moodLabel: direction.moodLabel,
      description: direction.description,
      palette: paletteColors.map((hex, index) => ({ hex, index })),
      tags: direction.tags,
    };
    const summaryBuffer = Buffer.from(JSON.stringify(summary, null, 2), "utf-8");
    const summaryKey = `sessions/${sessionId}/package/direction-summary.json`;
    await uploadImage(summaryKey, summaryBuffer, "application/json");
    deliverableInserts.push({
      sessionId,
      format: "direction-summary",
      fileKey: summaryKey,
      fileSizeBytes: summaryBuffer.length,
      width: null,
      height: null,
      mimeType: "application/json",
    });
    totalSizeBytes += summaryBuffer.length;

    // Step 6: Insert deliverable rows
    await db.insert(deliverables).values(deliverableInserts);

    // Step 7: Update session status to delivered
    await updateSessionStatus(sessionId, "delivered");

    return {
      ok: true,
      output: {
        deliverableCount: deliverableInserts.length,
        totalSizeBytes,
      },
      meta: {
        costCents: 0,
        durationMs: Date.now() - start,
      },
    };
  } catch (error) {
    console.error("[packaging] assemblePackage failed:", error);
    await failSession(sessionId, "packaging").catch(() => {});

    return {
      ok: false,
      error: {
        code: "PACKAGING_FAILED",
        message: "Something went wrong assembling your package. Give it another try.",
      },
      meta: {
        costCents: 0,
        durationMs: Date.now() - start,
      },
    };
  }
}

/**
 * Process source image for a specific platform spec.
 * Resizes, converts format, validates, and auto-fixes if needed.
 */
async function processForPlatform(
  sourceBuffer: Buffer,
  spec: typeof PLATFORM_SPECS[keyof typeof PLATFORM_SPECS]
): Promise<Buffer> {
  let pipeline = sharp(sourceBuffer).resize(spec.width, spec.height, {
    fit: "cover",
    position: "center",
  });

  if (spec.colorSpace === "sRGB") {
    pipeline = pipeline.toColorspace("srgb");
  }

  let quality = 92;

  if (spec.format === "jpeg") {
    pipeline = pipeline.jpeg({ quality, chromaSubsampling: "4:4:4" });
  } else if (spec.format === "png") {
    pipeline = pipeline.png();
  } else if (spec.format === "webp") {
    pipeline = pipeline.webp({ quality });
  }

  let result = await pipeline.toBuffer();

  // Check size constraint — reduce quality if needed (JPEG only)
  if (result.length > spec.maxFileSizeBytes && spec.format === "jpeg") {
    quality = 80;
    result = await sharp(sourceBuffer)
      .resize(spec.width, spec.height, { fit: "cover", position: "center" })
      .toColorspace("srgb")
      .jpeg({ quality })
      .toBuffer();
  }

  // If still too large after quality reduction, try auto-fix
  if (result.length > spec.maxFileSizeBytes) {
    result = await autoFix(result, spec);
  }

  // Validate the result
  const validation = await validateDeliverable(result, spec);
  if (!validation.valid) {
    console.warn(
      `[packaging] Validation failed for ${spec.name}, attempting auto-fix:`,
      validation.issues
    );
    result = await autoFix(result, spec);
  }

  return result;
}

/**
 * Generate a palette image with colored swatches.
 * Creates a horizontal strip of colored circles with hex labels.
 */
async function generatePaletteImage(colors: string[]): Promise<Buffer> {
  const swatchSize = 120;
  const padding = 20;
  const labelHeight = 30;
  const totalWidth = colors.length * (swatchSize + padding) + padding;
  const totalHeight = swatchSize + labelHeight + padding * 2;

  // Build SVG for the palette
  const swatches = colors
    .map((hex, i) => {
      const x = padding + i * (swatchSize + padding) + swatchSize / 2;
      const y = padding + swatchSize / 2;
      const labelY = padding + swatchSize + labelHeight - 5;
      return `
        <circle cx="${x}" cy="${y}" r="${swatchSize / 2}" fill="${hex}" />
        <text x="${x}" y="${labelY}" text-anchor="middle" font-family="monospace" font-size="14" fill="#ffffff">${hex}</text>
      `;
    })
    .join("");

  const svg = `
    <svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#09090b" />
      ${swatches}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

const FORMAT_FILENAMES: Record<string, string> = {
  "cover-spotify": "cover-3000x3000.jpg",
  "cover-apple": "cover-apple-3000x3000.jpg",
  "instagram-square": "instagram-square.jpg",
  "instagram-story": "instagram-story.jpg",
  "twitter-header": "twitter-header.jpg",
  "palette": "palette.png",
  "direction-summary": "direction-summary.json",
};

/**
 * Creates a ZIP bundle of all deliverables for a session.
 * Fetches files from R2, bundles them with archiver, uploads ZIP to R2,
 * and returns a signed URL for download.
 */
export async function createZipBundle(
  sessionId: string,
  userId: string
): Promise<{ url: string }> {
  // Verify session ownership
  const [session] = await db
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session || session.userId !== userId) {
    throw new Error("Session not found");
  }

  // Load deliverables
  const rows = await db
    .select({
      format: deliverables.format,
      fileKey: deliverables.fileKey,
    })
    .from(deliverables)
    .where(eq(deliverables.sessionId, sessionId));

  if (rows.length === 0) {
    throw new Error("No deliverables found for this session");
  }

  // Create ZIP
  const archive = archiver("zip", { zlib: { level: 5 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  for (const row of rows) {
    const fileBuffer = await downloadFromR2(row.fileKey);
    const filename = FORMAT_FILENAMES[row.format] ?? `${row.format}.bin`;
    archive.append(fileBuffer, { name: filename });
  }

  await archive.finalize();
  const zipBuffer = Buffer.concat(chunks);

  // Upload ZIP to R2
  const shortId = sessionId.slice(0, 8);
  const zipKey = `sessions/${sessionId}/package/elyra-package-${shortId}.zip`;
  await uploadImage(zipKey, zipBuffer, "application/zip");

  // Return signed URL
  const url = await getSignedImageUrl(zipKey);
  return { url };
}
