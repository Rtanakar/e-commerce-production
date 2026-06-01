// ============================================================================
// upload.controller.ts - HTTP layer for presigned uploads
// ============================================================================
// Thin controller — koi business rule nahi, seedha storage lib call.
// Auth: seller cookie jar (routes me requireSellerAuth lagega).
// ============================================================================

import type { Request, Response } from "express";
import {
  createPresignedUpload,
  deleteObject,
  putObject,
  buildKey,
  keyFromPublicUrl,
} from "../../lib/storage.js";
import { processImage, processThumbnail } from "../../lib/image-processor.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { UnauthorizedError, ForbiddenError, BadRequestError } from "../../utils/errors.js";
import type { PresignUploadDto, DeleteObjectDto } from "./upload.validator.js";
import type { MediaKind } from "../../lib/storage.js";

// image-type purpose kinds (folder decide). Non-image kind aaye to safe default.
const IMAGE_KINDS = new Set<MediaKind>([
  "product-images",
  "product-banner",
  "product-variant",
  "product-content-image",
  "image",
]);
function resolveImageKind(raw: unknown): MediaKind {
  return typeof raw === "string" && IMAGE_KINDS.has(raw as MediaKind)
    ? (raw as MediaKind)
    : "product-images";
}

// ============================================================================
// POST /uploads/image - server-side optimize (webp/avif) + R2/S3 upload
// ============================================================================
// Flow: multipart file (multer) → sharp optimize → R2 me upload → URL+meta wapas.
// Amazon/Flipkart pattern: high quality, compressed storage. DB me sirf URL.
// `?thumbnail=true` query → ek chhota thumb variant bhi banata + upload karta.
// ============================================================================
export async function uploadImage(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  if (!req.file) throw new BadRequestError("No image file provided (field name: 'file')");

  const scope = req.user.sub; // seller folder: <prefix>/<userId>/...
  const wantThumb = req.query.thumbnail === "true";
  // kind query/body se → purpose-based folder (product-images / product-banner / ...)
  const kind = resolveImageKind(req.query.kind ?? (req.body as { kind?: string })?.kind);

  // ── Main optimized image ──
  const main = await processImage(req.file.buffer);
  const mainKey = buildKey(kind, main.contentType, scope);
  const { publicUrl: url } = await putObject({
    key: mainKey,
    body: main.buffer,
    contentType: main.contentType,
  });

  // ── Optional thumbnail ──
  let thumbnail:
    | { url: string; key: string; width: number; height: number; sizeBytes: number }
    | undefined;
  if (wantThumb) {
    const thumb = await processThumbnail(req.file.buffer);
    const thumbKey = buildKey(kind, thumb.contentType, scope);
    const { publicUrl: turl } = await putObject({
      key: thumbKey,
      body: thumb.buffer,
      contentType: thumb.contentType,
    });
    thumbnail = {
      url: turl,
      key: thumbKey,
      width: thumb.width,
      height: thumb.height,
      sizeBytes: thumb.sizeBytes,
    };
  }

  res.status(HttpStatus.CREATED).json({
    ...ApiResponseBuilder.success({
      // ProductImage record me yahi fields jaayenge
      url,
      key: mainKey,
      format: main.format,
      width: main.width,
      height: main.height,
      sizeBytes: main.sizeBytes,
      // helpful debug: kitna compress hua
      originalBytes: req.file.size,
      ...(thumbnail && { thumbnail }),
    }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /uploads/presign - signed PUT URL do
// ============================================================================
export async function presignUpload(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const body = req.body as PresignUploadDto;

  // scope = userId → seller ka apna folder (images/<userId>/<uuid>.ext)
  const result = await createPresignedUpload({
    kind: body.kind,
    contentType: body.contentType,
    scope: req.user.sub,
    sizeBytes: body.sizeBytes,
  });

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// ============================================================================
// DELETE /uploads - object delete (key OR public URL accept)
// ============================================================================
// Ownership note: key seller ke folder prefix (images/<userId>/) se match
// karna chahiye — taaki ek seller doosre ka object delete na kar paaye.
// ============================================================================
export async function removeObject(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const { key: rawKey } = req.body as DeleteObjectDto;

  // Agar galti se full URL aa gaya to key nikaalne ki koshish
  const key = rawKey.startsWith("http") ? (keyFromPublicUrl(rawKey) ?? rawKey) : rawKey;

  // Folder-prefix ownership guard — apne hi scope ke object delete kar sakte
  if (!key.includes(`/${req.user.sub}/`)) {
    throw new ForbiddenError("You can only delete your own uploads");
  }

  await deleteObject(key);

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ deleted: true, key }),
    requestId: req.id,
  });
}
