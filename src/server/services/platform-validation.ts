import "server-only";

import sharp from "sharp";
import type { PlatformSpec } from "@/config/platform-specs";

export type ValidationIssue = {
  field: "width" | "height" | "format" | "fileSize" | "colorSpace";
  expected: string;
  actual: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

/**
 * Validates a buffer against platform specifications.
 * Checks dimensions, file size, and format.
 */
export async function validateDeliverable(
  buffer: Buffer,
  spec: PlatformSpec
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const metadata = await sharp(buffer).metadata();

  if (metadata.width !== spec.width) {
    issues.push({
      field: "width",
      expected: String(spec.width),
      actual: String(metadata.width ?? "unknown"),
    });
  }

  if (metadata.height !== spec.height) {
    issues.push({
      field: "height",
      expected: String(spec.height),
      actual: String(metadata.height ?? "unknown"),
    });
  }

  const expectedFormat = spec.format === "jpeg" ? "jpeg" : spec.format;
  if (metadata.format !== expectedFormat) {
    issues.push({
      field: "format",
      expected: expectedFormat,
      actual: String(metadata.format ?? "unknown"),
    });
  }

  if (buffer.length > spec.maxFileSizeBytes) {
    issues.push({
      field: "fileSize",
      expected: `<=${spec.maxFileSizeBytes}`,
      actual: String(buffer.length),
    });
  }

  console.log(
    `[platform-validation] spec=${spec.name} valid=${issues.length === 0} issues=${JSON.stringify(issues)}`
  );

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Attempts to auto-fix a buffer to meet platform specifications.
 * Re-encodes with lower quality if oversized, resizes if wrong dimensions,
 * converts format if mismatched.
 */
export async function autoFix(
  buffer: Buffer,
  spec: PlatformSpec
): Promise<Buffer> {
  let pipeline = sharp(buffer).resize(spec.width, spec.height, {
    fit: "cover",
    position: "center",
  });

  if (spec.colorSpace === "sRGB") {
    pipeline = pipeline.toColorspace("srgb");
  }

  if (spec.format === "jpeg") {
    pipeline = pipeline.jpeg({ quality: 85, chromaSubsampling: "4:4:4" });
  } else if (spec.format === "png") {
    pipeline = pipeline.png();
  } else if (spec.format === "webp") {
    pipeline = pipeline.webp({ quality: 85 });
  }

  let result = await pipeline.toBuffer();

  // If still too large, reduce quality further
  if (result.length > spec.maxFileSizeBytes && spec.format === "jpeg") {
    result = await sharp(buffer)
      .resize(spec.width, spec.height, { fit: "cover", position: "center" })
      .toColorspace("srgb")
      .jpeg({ quality: 70 })
      .toBuffer();
  }

  console.log(
    `[platform-validation] autoFix spec=${spec.name} originalSize=${buffer.length} fixedSize=${result.length}`
  );

  return result;
}
