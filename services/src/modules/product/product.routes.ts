// ============================================================================
// product.routes.ts - Product endpoints
// ============================================================================
// PUBLIC (storefront, no auth):
//   GET    /api/v1/products                 → listing (ACTIVE, cursor+offset)
//   GET    /api/v1/products/:slug           → public detail
//
// SELLER (seller cookie jar — requireSellerAuth):
//   GET    /api/v1/products/seller/mine     → "All Products" (DRAFT bhi)
//   GET    /api/v1/products/seller/:id      → edit-form fetch
//   POST   /api/v1/products                 → create  (Save Draft / Create)
//   PATCH  /api/v1/products/:id             → update
//   POST   /api/v1/products/:id/archive     → soft delete
//   POST   /api/v1/products/:id/restore     → ARCHIVED → DRAFT
//   DELETE /api/v1/products/:id             → hard delete + media cleanup
//
// ROUTE ORDER: /seller/* aur /:id routes ko /:slug se pehle/clearly rakha hai
// taaki literal segments slug capture na karein.
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireSellerAuth } from "../../middlewares/require-auth.js";
import { requireSellerCsrf } from "../../middlewares/csrf.js";
import * as productController from "./product.controller.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  productIdParam,
  productSlugParam,
} from "./product.validator.js";

const router: Router = Router();

// ============================================================================
// SELLER reads (literal "seller" prefix — slug se pehle register)
// ============================================================================
router.get(
  "/seller/mine",
  requireSellerAuth,
  validate(listProductsSchema, "query"),
  asyncHandler(productController.listMine),
);

router.get(
  "/seller/:id",
  requireSellerAuth,
  validate(productIdParam, "params"),
  asyncHandler(productController.getMineById),
);

// ============================================================================
// SELLER writes
// ============================================================================
router.post(
  "/",
  requireSellerCsrf,
  requireSellerAuth,
  validate(createProductSchema),
  asyncHandler(productController.create),
);

router.patch(
  "/:id",
  requireSellerCsrf,
  requireSellerAuth,
  validate(productIdParam, "params"),
  validate(updateProductSchema),
  asyncHandler(productController.update),
);

router.post(
  "/:id/archive",
  requireSellerCsrf,
  requireSellerAuth,
  validate(productIdParam, "params"),
  asyncHandler(productController.archive),
);

router.post(
  "/:id/restore",
  requireSellerCsrf,
  requireSellerAuth,
  validate(productIdParam, "params"),
  asyncHandler(productController.restore),
);

router.delete(
  "/:id",
  requireSellerCsrf,
  requireSellerAuth,
  validate(productIdParam, "params"),
  asyncHandler(productController.remove),
);

// ============================================================================
// PUBLIC reads (slug catch-all LAST)
// ============================================================================
router.get("/", validate(listProductsSchema, "query"), asyncHandler(productController.listPublic));

router.get(
  "/:slug",
  validate(productSlugParam, "params"),
  asyncHandler(productController.getBySlug),
);

export default router;
