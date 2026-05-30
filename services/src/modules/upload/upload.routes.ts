// ============================================================================
// upload.routes.ts - Upload endpoints (seller cookie jar)
// ============================================================================
//   POST   /api/v1/uploads/image    → multipart image → sharp optimize (webp/
//                                       avif) → R2/S3 → {url,key,w,h,bytes}
//                                       (?thumbnail=true → thumb variant bhi)
//   POST   /api/v1/uploads/presign  → signed PUT URL (video/file — raw direct,
//                                       in par sharp nahi chalta)
//   DELETE /api/v1/uploads          → object delete by key
//
// Seller portal media flow, isliye seller cookie jar (requireSellerAuth +
// requireSellerCsrf). Customer cookies yahan kaam nahi karenge.
//
// /image route order: CSRF + auth pehle (header-based, body nahi chahiye), FIR
// multer (multipart parse), FIR controller.
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireSellerAuth } from "../../middlewares/require-auth.js";
import { requireSellerCsrf } from "../../middlewares/csrf.js";
import { uploadImageMiddleware } from "../../middlewares/upload-multer.js";
import * as uploadController from "./upload.controller.js";
import { presignUploadSchema, deleteObjectSchema } from "./upload.validator.js";

const router: Router = Router();

// ----- Server-side image optimization (webp/avif compress) -----
router.post(
  "/image",
  requireSellerCsrf,
  requireSellerAuth,
  uploadImageMiddleware,
  asyncHandler(uploadController.uploadImage),
);

// ----- Presigned PUT (video / large files — sharp se nahi guzarte) -----
router.post(
  "/presign",
  requireSellerCsrf,
  requireSellerAuth,
  validate(presignUploadSchema),
  asyncHandler(uploadController.presignUpload),
);

router.delete(
  "/",
  requireSellerCsrf,
  requireSellerAuth,
  validate(deleteObjectSchema),
  asyncHandler(uploadController.removeObject),
);

export default router;
