// ============================================================================
// discount.routes.ts - Seller discount code endpoints
// ============================================================================
// Sab seller-scoped (seller cookie jar). "Discount Codes" sidebar section.
//
//   GET    /api/v1/discounts          → list (cursor + offset, search/filter)
//   POST   /api/v1/discounts          → create
//   GET    /api/v1/discounts/:id       → single
//   PATCH  /api/v1/discounts/:id       → update
//   DELETE /api/v1/discounts/:id       → delete
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireSellerAuth } from "../../middlewares/require-auth.js";
import { requireSellerCsrf } from "../../middlewares/csrf.js";
import * as discountController from "./discount.controller.js";
import {
  createDiscountSchema,
  updateDiscountSchema,
  listDiscountsSchema,
  discountIdParam,
} from "./discount.validator.js";

const router: Router = Router();

router.get(
  "/",
  requireSellerAuth,
  validate(listDiscountsSchema, "query"),
  asyncHandler(discountController.list),
);

router.post(
  "/",
  requireSellerCsrf,
  requireSellerAuth,
  validate(createDiscountSchema),
  asyncHandler(discountController.create),
);

router.get(
  "/:id",
  requireSellerAuth,
  validate(discountIdParam, "params"),
  asyncHandler(discountController.getById),
);

router.patch(
  "/:id",
  requireSellerCsrf,
  requireSellerAuth,
  validate(discountIdParam, "params"),
  validate(updateDiscountSchema),
  asyncHandler(discountController.update),
);

router.delete(
  "/:id",
  requireSellerCsrf,
  requireSellerAuth,
  validate(discountIdParam, "params"),
  asyncHandler(discountController.remove),
);

export default router;
