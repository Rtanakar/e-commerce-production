// ============================================================================
// upload.validator.ts - Zod schemas for presigned upload endpoints
// ============================================================================

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================================
// PRESIGN - ek presigned PUT URL maangna
// ============================================================================
// kind         → image | video | file (storage rules + folder decide karta hai)
// contentType  → MIME type, server isse whitelist + extension nikaalta hai
// sizeBytes    → optional, server-side size guard (client cheat kar sakta hai
//                par yeh first line of defense; real enforcement bucket policy)
// ============================================================================
// Purpose-based kinds (storage.ts MediaKind ka mirror) + legacy retained
const uploadKindEnum = z.enum([
  "product-images",
  "product-banner",
  "product-variant",
  "product-content-image",
  "product-content-file",
  "product-video",
  // legacy
  "image",
  "video",
  "file",
]);

export const presignUploadSchema = z
  .object({
    kind: uploadKindEnum.default("image"),
    contentType: z.string().min(3).max(100).openapi({ example: "image/webp" }),
    sizeBytes: z.number().int().positive().optional(),
  })
  .openapi("PresignUploadRequest");

// /uploads/image (multipart) ke liye optional kind (folder decide karta) —
// query ya body se aa sakta. Image-type kinds hi valid (server sharp optimize).
export const uploadImageQuerySchema = z.object({
  kind: uploadKindEnum.optional(),
  thumbnail: z.coerce.boolean().optional(),
});

// ============================================================================
// DELETE - object key se storage object hatao
// ============================================================================
// Sirf key accept karte hain (full URL nahi) — taaki client koi external URL
// pass karke confusion na kare. Frontend presign response ka `key` rakhta hai.
// ============================================================================
export const deleteObjectSchema = z
  .object({
    key: z.string().min(1).max(500).openapi({ example: "images/abc/uuid.webp" }),
  })
  .openapi("DeleteObjectRequest");

export type PresignUploadDto = z.infer<typeof presignUploadSchema>;
export type DeleteObjectDto = z.infer<typeof deleteObjectSchema>;
export type UploadImageQuery = z.infer<typeof uploadImageQuerySchema>;
