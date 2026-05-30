// ============================================================================
// image-processor.ts - Server-side image optimization (sharp)
// ============================================================================
// Amazon/Flipkart pattern: image backend se guzarti hai, yahan optimize hoti
// hai, FIR R2/S3 me jaati hai. DB me sirf optimized URL.
//
// Optimization steps:
//   1. EXIF auto-rotate (phone photos sideways na dikhein) + metadata strip
//      (privacy: GPS/camera info hata + file size kam)
//   2. Resize — bade side ko IMAGE_MAX_DIMENSION pe cap (withoutEnlargement:
//      chhoti image ko stretch nahi karte → quality loss avoid)
//   3. Encode — WebP ya AVIF (env), quality 80 → high quality + ~70% chhota
//      JPEG se. Yahi "high quality + compressed storage" ka core hai.
//
// Bonus: thumbnail variant (listing cards ke liye — chhoti, ultra-compressed).
//
// Security: sharp non-image buffer pe throw karta hai → content-type spoofing
// (fake .jpg jo actually .exe) yahin block ho jaata hai.
// ============================================================================

import sharp from "sharp";
import { env } from "../config/env.js";
import { BadRequestError } from "../utils/errors.js";

export interface ProcessedImage {
  buffer: Buffer;
  format: "webp" | "avif";
  contentType: string; // "image/webp" | "image/avif"
  ext: string; // "webp" | "avif"
  width: number;
  height: number;
  sizeBytes: number;
}

// ============================================================================
// encode - shared encoder (main + thumb dono isi se)
// ============================================================================
function encode(pipeline: sharp.Sharp, format: "webp" | "avif", quality: number): sharp.Sharp {
  return format === "avif"
    ? pipeline.avif({ quality, effort: 4 }) // effort 4 = speed/size balance
    : pipeline.webp({ quality, effort: 4 });
}

// ============================================================================
// processImage - main optimized image
// ============================================================================
export async function processImage(
  input: Buffer,
  opts?: { maxDimension?: number; quality?: number },
): Promise<ProcessedImage> {
  const format = env.IMAGE_FORMAT;
  const quality = opts?.quality ?? env.IMAGE_QUALITY;
  const maxDim = opts?.maxDimension ?? env.IMAGE_MAX_DIMENSION;

  let result: { data: Buffer; info: sharp.OutputInfo };
  try {
    // failOn:"none" → thodi corrupt images bhi process ho jaayein (strict nahi)
    const pipeline = sharp(input, { failOn: "none", animated: true })
      .rotate() // EXIF orientation apply (metadata strip se pehle)
      .resize({
        width: maxDim,
        height: maxDim,
        fit: "inside", // aspect ratio preserve, box ke andar fit
        withoutEnlargement: true, // chhoti image upscale mat karo
      });

    result = await encode(pipeline, format, quality).toBuffer({
      resolveWithObject: true,
    });
  } catch {
    // sharp parse fail = ye valid image nahi hai (spoofed content-type)
    throw new BadRequestError("Uploaded file is not a valid image");
  }

  return {
    buffer: result.data,
    format,
    contentType: `image/${format}`,
    ext: format,
    width: result.info.width,
    height: result.info.height,
    sizeBytes: result.data.length,
  };
}

// ============================================================================
// processThumbnail - chhota listing-card variant
// ============================================================================
// Width-capped (IMAGE_THUMB_WIDTH), thoda lower quality — cards me size matters
// nahi quality, par bandwidth/storage minimal. Optional use.
// ============================================================================
export async function processThumbnail(
  input: Buffer,
  opts?: { width?: number; quality?: number },
): Promise<ProcessedImage> {
  const format = env.IMAGE_FORMAT;
  const quality = opts?.quality ?? Math.min(env.IMAGE_QUALITY, 70);
  const width = opts?.width ?? env.IMAGE_THUMB_WIDTH;

  let result: { data: Buffer; info: sharp.OutputInfo };
  try {
    const pipeline = sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true });
    result = await encode(pipeline, format, quality).toBuffer({
      resolveWithObject: true,
    });
  } catch {
    throw new BadRequestError("Uploaded file is not a valid image");
  }

  return {
    buffer: result.data,
    format,
    contentType: `image/${format}`,
    ext: format,
    width: result.info.width,
    height: result.info.height,
    sizeBytes: result.data.length,
  };
}
