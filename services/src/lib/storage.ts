// ============================================================================
// storage.ts - Object storage (images / videos / files) - R2 + S3
// ============================================================================
// Provider-agnostic — mailer.ts / sms.ts ka same pattern. STORAGE_PROVIDER env
// se decide hota hai R2 (primary) ya AWS S3 (future). Dono S3-compatible hain,
// isliye ek hi @aws-sdk/client-s3 client dono ke liye kaam karta hai — bas
// endpoint + credentials alag.
//
// Upload strategy = PRESIGNED PUT URL (Amazon/Flipkart scale pattern):
//   1. Client backend se presigned URL maangta hai (key + contentType)
//   2. Backend short-lived signed PUT URL deta hai (file backend se nahi guzarti)
//   3. Client SEEDHA R2/S3 ko file PUT karta hai (backend bandwidth bachta hai)
//   4. Client public URL + key DB me save karta hai (product image record)
//
// Cleanup: product delete pe `deleteObject(key)` se orphan media hatate hain.
// ============================================================================

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { BadRequestError, ServiceUnavailableError } from "../utils/errors.js";

// ============================================================================
// Client singleton - provider ke hisaab se configure
// ============================================================================
// Lazy init — pehli baar use pe banta hai, taaki storage configure na ho to
// app start fail na ho (sirf upload routes hit karne pe error aaye).
// ============================================================================
let _client: S3Client | null = null;

function buildClient(): S3Client {
  if (env.STORAGE_PROVIDER === "r2") {
    // ── Cloudflare R2 ──
    const endpoint =
      env.R2_ENDPOINT ??
      (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

    if (!endpoint || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      throw new ServiceUnavailableError(
        "R2 storage is not configured (R2_ENDPOINT/R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY required)",
      );
    }

    return new S3Client({
      region: env.R2_REGION, // R2 → "auto"
      endpoint,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      // R2 path-style nahi maangta par S3-compat ke liye safe default
      forcePathStyle: false,
    });
  }

  // ── AWS S3 ──
  if (!env.AWS_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    throw new ServiceUnavailableError(
      "S3 storage is not configured (AWS_REGION + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY required)",
    );
  }

  return new S3Client({
    region: env.AWS_REGION,
    // Custom endpoint (MinIO/LocalStack) — warna AWS default endpoint
    ...(env.AWS_S3_ENDPOINT && {
      endpoint: env.AWS_S3_ENDPOINT,
      forcePathStyle: true, // MinIO/LocalStack ke liye zaroori
    }),
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

function getClient(): S3Client {
  if (!_client) _client = buildClient();
  return _client;
}

function getBucket(): string {
  if (!env.STORAGE_BUCKET) {
    throw new ServiceUnavailableError("STORAGE_BUCKET env is not set — object storage unavailable");
  }
  return env.STORAGE_BUCKET;
}

// ============================================================================
// publicUrl - object key → browser-accessible URL
// ============================================================================
export function publicUrl(key: string): string {
  if (!env.STORAGE_PUBLIC_URL) {
    throw new ServiceUnavailableError("STORAGE_PUBLIC_URL env is not set");
  }
  const base = env.STORAGE_PUBLIC_URL.replace(/\/+$/, ""); // trailing slash hatao
  const cleanKey = key.replace(/^\/+/, "");
  return `${base}/${cleanKey}`;
}

// ============================================================================
// keyFromPublicUrl - URL se vapas object key nikaalo (cleanup ke liye)
// ============================================================================
// Public URL: https://cdn.shop.com/products/abc/uuid.jpg → products/abc/uuid.jpg
// Agar URL hamare STORAGE_PUBLIC_URL se match nahi karta (external/legacy) to
// null — taaki galti se kisi aur ka object delete na karein.
// ============================================================================
export function keyFromPublicUrl(url: string): string | null {
  if (!url || !env.STORAGE_PUBLIC_URL) return null;
  const base = env.STORAGE_PUBLIC_URL.replace(/\/+$/, "");
  if (!url.startsWith(base)) return null;
  const key = url.slice(base.length).replace(/^\/+/, "");
  return key || null;
}

// ============================================================================
// MEDIA categories - key prefix + allowed content types + size cap
// ============================================================================
// Folder structure: <category>/<vendorId>/<uuid>.<ext>
// Isse storage browse karna + lifecycle rules (e.g. tmp expire) aasaan.
// ============================================================================
// ── Purpose-based media kinds (course/LMS pattern) ──────────────────────────
// Har kind ka apna R2 folder (prefix). Isse storage browse + lifecycle rules
// aasaan. Legacy kinds (image/video/file) backward-compat ke liye retained —
// purane callers tootein na.
export type MediaKind =
  // product purpose-based
  | "product-images" // gallery
  | "product-banner" // banner strip
  | "product-variant" // variant gallery
  | "product-content-image" // TipTap inline image
  | "product-content-file" // TipTap attachment (pdf/doc/...)
  | "product-video" // product/demo + TipTap video
  // legacy (generic) — abhi bhi accept
  | "image"
  | "video"
  | "file";

// Common MIME groups (DRY)
const IMG_MIME = /^image\/(jpeg|png|webp|avif|gif)$/;
const VID_MIME = /^video\/(mp4|webm|quicktime|x-matroska)$/;
// pdf, word, excel, powerpoint, zip, json, plain, markdown, csv
const FILE_MIME =
  /^(application\/(pdf|zip|x-zip-compressed|json|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|vnd\.ms-(excel|powerpoint))|text\/(plain|markdown|csv))$/;

const MB = 1024 * 1024;

const MEDIA_RULES: Record<MediaKind, { prefix: string; maxBytes: number; allowed: RegExp }> = {
  // ── Product (purpose-based) ──
  "product-images": { prefix: "product-images", maxBytes: 5 * MB, allowed: IMG_MIME },
  "product-banner": { prefix: "product-banner", maxBytes: 5 * MB, allowed: IMG_MIME },
  "product-variant": { prefix: "product-variant", maxBytes: 5 * MB, allowed: IMG_MIME },
  "product-content-image": { prefix: "product-content-image", maxBytes: 5 * MB, allowed: IMG_MIME },
  "product-content-file": { prefix: "product-content-file", maxBytes: 50 * MB, allowed: FILE_MIME },
  "product-video": { prefix: "product-video", maxBytes: 200 * MB, allowed: VID_MIME },

  // ── Legacy (generic folders) — backward-compat ──
  image: { prefix: "images", maxBytes: 5 * MB, allowed: IMG_MIME },
  video: { prefix: "videos", maxBytes: 200 * MB, allowed: VID_MIME },
  file: { prefix: "files", maxBytes: 50 * MB, allowed: FILE_MIME },
};

// contentType → extension (key banane ke liye)
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/json": "json",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
};

// ============================================================================
// buildKey - deterministic, collision-safe object key
// ============================================================================
// scope = usually vendorId (seller ka folder). uuid → unique filename.
// ============================================================================
export function buildKey(kind: MediaKind, contentType: string, scope: string): string {
  const rule = MEDIA_RULES[kind];
  const ext = EXT_BY_TYPE[contentType] ?? "bin";
  const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "misc";
  return `${rule.prefix}/${safeScope}/${randomUUID()}.${ext}`;
}

// ============================================================================
// createPresignedUpload - short-lived signed PUT URL
// ============================================================================
// Returns { uploadUrl, key, publicUrl }. Client uploadUrl pe file PUT karega
// (same Content-Type header ke saath), fir publicUrl + key DB me save karega.
// ============================================================================
export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

export async function createPresignedUpload(params: {
  kind: MediaKind;
  contentType: string;
  scope: string;
  sizeBytes?: number;
}): Promise<PresignedUpload> {
  const { kind, contentType, scope, sizeBytes } = params;
  const rule = MEDIA_RULES[kind];

  // ── Content-type whitelist (security — koi .exe na chadhaaye) ──
  if (!rule.allowed.test(contentType)) {
    throw new BadRequestError(
      `Unsupported ${kind} type "${contentType}". Allowed: ${rule.allowed.source}`,
    );
  }

  // ── Size guard (agar client ne size bheja) ──
  if (sizeBytes !== undefined && sizeBytes > rule.maxBytes) {
    throw new BadRequestError(
      `${kind} too large: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB (max ${rule.maxBytes / 1024 / 1024}MB)`,
    );
  }

  const key = buildKey(kind, contentType, scope);

  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: env.STORAGE_PRESIGN_EXPIRY,
  });

  return {
    uploadUrl,
    key,
    publicUrl: publicUrl(key),
    expiresIn: env.STORAGE_PRESIGN_EXPIRY,
  };
}

// ============================================================================
// putObject - buffer ko seedha storage me upload (server-side processed media)
// ============================================================================
// Image processing flow: sharp se optimize → yahan buffer upload → publicUrl
// DB me. CacheControl immutable kyunki key uuid-based hai (kabhi overwrite
// nahi hoti) → CDN/browser hamesha cache kar sakte hain (1 saal).
// ============================================================================
export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<{ key: string; publicUrl: string }> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: params.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return { key: params.key, publicUrl: publicUrl(params.key) };
}

// ============================================================================
// deleteObject - single object delete (best-effort)
// ============================================================================
export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

// ============================================================================
// deleteObjects - batch delete (product delete pe saari images ek call me)
// ============================================================================
// S3 DeleteObjects max 1000 keys/call. Best-effort — per-key failure log,
// throw nahi (DB source of truth, orphan object ops sweep job ka kaam).
// ============================================================================
export async function deleteObjects(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return;

  // 1000 ke chunks me todo
  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    try {
      await getClient().send(
        new DeleteObjectsCommand({
          Bucket: getBucket(),
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    } catch (err) {
      logger.warn({ err, count: chunk.length }, "[storage] batch delete failed (continuing)");
    }
  }
}
