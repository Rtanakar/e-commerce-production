// ============================================================================
// category.routes.ts - Category endpoints
// ============================================================================
// Public reads (list/detail) — koi auth nahi (storefront + seller dropdown).
// Writes (create/update/delete) — ADMIN only (customer cookie jar + role gate).
//
//   GET    /api/v1/categories          → list (tree default)
//   GET    /api/v1/categories/:slug     → single + children
//   POST   /api/v1/categories          → create   (ADMIN)
//   PATCH  /api/v1/categories/:id       → update   (ADMIN)
//   DELETE /api/v1/categories/:id       → delete   (ADMIN)
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireAuth, requireRole } from "../../middlewares/require-auth.js";
import { requireCsrf } from "../../middlewares/csrf.js";
import * as categoryController from "./category.controller.js";
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesSchema,
  categoryIdParam,
  categorySlugParam,
} from "./category.validator.js";

const router: Router = Router();

// ----- Public reads -----
router.get("/", validate(listCategoriesSchema, "query"), asyncHandler(categoryController.list));

router.get(
  "/:slug",
  validate(categorySlugParam, "params"),
  asyncHandler(categoryController.getBySlug),
);

// ----- Admin writes -----
router.post(
  "/",
  requireCsrf,
  requireAuth,
  requireRole("ADMIN"),
  validate(createCategorySchema),
  asyncHandler(categoryController.create),
);

router.patch(
  "/:id",
  requireCsrf,
  requireAuth,
  requireRole("ADMIN"),
  validate(categoryIdParam, "params"),
  validate(updateCategorySchema),
  asyncHandler(categoryController.update),
);

router.delete(
  "/:id",
  requireCsrf,
  requireAuth,
  requireRole("ADMIN"),
  validate(categoryIdParam, "params"),
  asyncHandler(categoryController.remove),
);

export default router;
