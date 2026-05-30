// ============================================================================
// upload-multer.ts - Multipart file parsing (memory storage)
// ============================================================================
// Image backend se guzar ke sharp me process hoti hai, isliye file ko RAM me
// buffer chahiye (memoryStorage — disk pe likhe bina). multer.single("file").
//
// Limits:
//   - fileSize: IMAGE_MAX_UPLOAD_BYTES (raw, compress se pehle) — DoS guard
//   - sirf image/* content-type accept (asli validation sharp karta hai jab
//     decode hoti hai; ye pehla sasta filter hai)
// ============================================================================

import multer, { MulterError } from "multer";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { env } from "../config/env.js";
import { BadRequestError } from "../utils/errors.js";

const storage = multer.memoryStorage();

function imageFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  // Pehla sasta gate — content-type image/* hona chahiye
  if (!/^image\//.test(file.mimetype)) {
    cb(new BadRequestError("Only image files are allowed"));
    return;
  }
  cb(null, true);
}

// Single image field "file" — POST /uploads/image
const rawSingle = multer({
  storage,
  limits: { fileSize: env.IMAGE_MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: imageFileFilter,
}).single("file");

// ============================================================================
// uploadImageMiddleware - rawSingle ko wrap karke errors ko AppError me map
// ============================================================================
// multer file-too-large pe MulterError "LIMIT_FILE_SIZE" throw karta hai —
// usse 400 BadRequest me convert karte hain (warna error-handler 500 deta).
// ============================================================================
export const uploadImageMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  rawSingle(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        const mb = (env.IMAGE_MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
        return next(new BadRequestError(`Image too large (max ${mb}MB)`));
      }
      return next(new BadRequestError(`Upload failed: ${err.message}`));
    }
    if (err) return next(err); // fileFilter ke BadRequestError ya aur kuch
    next();
  });
};
