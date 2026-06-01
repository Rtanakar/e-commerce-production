// ============================================================================
// upload-media.ts — Media upload helpers (seller cookie jar)
// ============================================================================
// Backend endpoints:
//   POST /uploads/image   → multipart, sharp optimize (webp/avif), returns
//                            { url, key, width, height, sizeBytes, ... }
//   POST /uploads/presign → video/large file ke liye signed PUT URL
//   DELETE /uploads       → object delete by key (ownership guard)
//
// Images backend se guzar ke optimize hoti hain (Amazon/Flipkart pattern).
// Videos seedha R2 ko PUT hoti hain (sharp un par nahi chalta).
// ============================================================================

import { sellerHttp } from "@/lib/seller-auth/api";
import { ApiError } from "@/lib/api";
import { CATALOG } from "@/config/constants";

// ─── API base (same as seller client — same-origin proxy) ───
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const CSRF_HEADER = "X-CSRF-Token";

// ============================================================================
// UploadKind — purpose-based R2 folders (backend storage.ts MediaKind mirror)
// ============================================================================
// Har kind ka apna Cloudflare folder. Image kinds backend /uploads/image
// (sharp optimize) se, video/file kinds presigned PUT se.
export type UploadKind =
  | "product-images"
  | "product-banner"
  | "product-variant"
  | "product-content-image"
  | "product-content-file"
  | "product-video";

export interface UploadedImage {
  url: string;
  key: string;
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalBytes?: number;
  thumbnail?: {
    url: string;
    key: string;
    width: number;
    height: number;
    sizeBytes: number;
  };
}

export interface PresignResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

// ============================================================================
// uploadImage — multipart → backend optimize → { url, key, ... }
// ============================================================================
// sellerHttp FormData support karta hai par CSRF header chahiye. Yahan direct
// fetch use karte hain taaki progress (future) + FormData clean rahe. CSRF
// token cookie se read karte hain (seller-csrf-token).
// ============================================================================
function readSellerCsrf(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)seller-csrf-token=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export async function uploadImage(
  file: File,
  opts?: { thumbnail?: boolean; kind?: UploadKind },
): Promise<UploadedImage> {
  // Client-side guard (server bhi check karta hai)
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  if (file.size > CATALOG.MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(
      `Image too large (max ${CATALOG.MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024}MB)`,
    );
  }

  const form = new FormData();
  form.append("file", file);

  const csrf = readSellerCsrf();
  // kind → purpose-based R2 folder (default product-images). thumbnail optional.
  const params = new URLSearchParams();
  params.set("kind", opts?.kind ?? "product-images");
  if (opts?.thumbnail) params.set("thumbnail", "true");
  const qs = `?${params.toString()}`;

  const res = await fetch(`${API_URL}/uploads/image${qs}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(csrf && { [CSRF_HEADER]: csrf }),
      Accept: "application/json",
    },
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? "UPLOAD_FAILED",
      json?.error?.message ?? "Image upload failed",
    );
  }
  return json.data as UploadedImage;
}

// ============================================================================
// uploadVideo — presign → direct R2 PUT → public URL
// ============================================================================
export async function uploadVideo(
  file: File,
  kind: UploadKind = "product-video",
): Promise<{ url: string; key: string }> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Only video files are allowed");
  }
  if (file.size > CATALOG.MAX_VIDEO_UPLOAD_BYTES) {
    throw new Error(
      `Video too large (max ${CATALOG.MAX_VIDEO_UPLOAD_BYTES / 1024 / 1024}MB)`,
    );
  }

  // 1. presign (kind → product-video folder)
  const presign = await sellerHttp.post<PresignResult>("/uploads/presign", {
    kind,
    contentType: file.type,
    sizeBytes: file.size,
  });

  // 2. direct PUT to R2/S3 (same Content-Type)
  await putToStorage(presign.uploadUrl, file, file.type);

  return { url: presign.publicUrl, key: presign.key };
}

// ============================================================================
// uploadFile — presign → direct PUT (generic files, e.g. TipTap attachments)
// ============================================================================
export async function uploadFile(
  file: File,
  kind: UploadKind = "product-content-file",
): Promise<{ url: string; key: string }> {
  const contentType = file.type || "application/octet-stream";
  const presign = await sellerHttp.post<PresignResult>("/uploads/presign", {
    kind,
    contentType,
    sizeBytes: file.size,
  });
  await putToStorage(presign.uploadUrl, file, contentType);
  return { url: presign.publicUrl, key: presign.key };
}

// ============================================================================
// putToStorage — direct PUT to R2/S3 with CORS/network-aware error
// ============================================================================
// Common failure: R2 bucket CORS PUT rule missing (browser direct upload). "Failed
// to fetch" opaque hota hai → clear hint dete hain taaki user fix kar sake.
async function putToStorage(
  uploadUrl: string,
  body: File,
  contentType: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
    });
  } catch (err) {
    throw new Error(
      "Upload to storage failed (network/CORS). R2 bucket CORS me is origin se PUT allow karein. " +
        (err instanceof Error ? err.message : String(err)),
    );
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const txt = await res.text();
      if (txt) detail = `${detail} — ${txt.slice(0, 160)}`;
    } catch {
      /* ignore */
    }
    throw new Error(`Storage upload failed (${res.status}): ${detail}`);
  }
}

// ============================================================================
// deleteMedia — storage se object hatao (key OR public URL accept)
// ============================================================================
// Backend `removeObject` URL ko key me resolve kar leta hai (keyFromPublicUrl)
// aur ownership-prefix check karta hai. Isliye key na ho to URL bhej sakte hain.
export async function deleteMedia(keyOrUrl: string): Promise<void> {
  if (!keyOrUrl) return;
  await sellerHttp.del("/uploads", { key: keyOrUrl });
}

export async function deleteMediaBulk(keys: string[]): Promise<void> {
  await Promise.allSettled(keys.filter(Boolean).map((k) => deleteMedia(k)));
}
