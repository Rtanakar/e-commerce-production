// ============================================================================
// category.routes.ts - Category endpoints
// ============================================================================
// Public reads (list/detail) — koi auth nahi (storefront + seller dropdown).
// Writes (create/update/delete) — SELLER cookie jar (seller portal se taxonomy
// manage hoti hai). Note: real Amazon me admin-only hota; is project me seller
// apni categories bana sakta (single-tenant dev) — isliye seller jar.
//
//   GET    /api/v1/categories          → list (tree default)   [public]
//   GET    /api/v1/categories/:slug     → single + children     [public]
//   POST   /api/v1/categories          → create   [seller]
//   PATCH  /api/v1/categories/:id       → update   [seller]
//   DELETE /api/v1/categories/:id       → delete   [seller]
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireSellerAuth } from "../../middlewares/require-auth.js";
import { requireSellerCsrf } from "../../middlewares/csrf.js";
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

// ----- Seller writes (seller cookie jar) -----
router.post(
  "/",
  requireSellerCsrf,
  requireSellerAuth,
  validate(createCategorySchema),
  asyncHandler(categoryController.create),
);

router.patch(
  "/:id",
  requireSellerCsrf,
  requireSellerAuth,
  validate(categoryIdParam, "params"),
  validate(updateCategorySchema),
  asyncHandler(categoryController.update),
);

router.delete(
  "/:id",
  requireSellerCsrf,
  requireSellerAuth,
  validate(categoryIdParam, "params"),
  asyncHandler(categoryController.remove),
);

export default router;
