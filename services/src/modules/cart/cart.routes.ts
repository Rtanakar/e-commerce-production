// ============================================================================
// cart.routes.ts - Customer cart endpoints (customer cookie jar)
// ============================================================================
// Sab logged-in customer ke liye (requireAuth + requireCsrf on mutations).
// Guest cart client-side (Zustand) chalta; login pe /cart/merge se sync.
//
//   GET    /api/v1/cart            → full cart + totals
//   GET    /api/v1/cart/count      → total item count (header badge)
//   POST   /api/v1/cart/items      → add / increment
//   PATCH  /api/v1/cart/items      → set absolute quantity (0 = remove)
//   DELETE /api/v1/cart/items      → remove one line
//   DELETE /api/v1/cart            → clear cart
//   POST   /api/v1/cart/merge      → merge guest cart on login
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { requireCsrf } from "../../middlewares/csrf.js";
import * as cartController from "./cart.controller.js";
import {
  addToCartSchema,
  setQtySchema,
  removeFromCartSchema,
  mergeCartSchema,
} from "./cart.validator.js";

const router: Router = Router();

router.get("/", requireAuth, asyncHandler(cartController.get));
router.get("/count", requireAuth, asyncHandler(cartController.count));

router.post(
  "/items",
  requireCsrf,
  requireAuth,
  validate(addToCartSchema),
  asyncHandler(cartController.add),
);

router.patch(
  "/items",
  requireCsrf,
  requireAuth,
  validate(setQtySchema),
  asyncHandler(cartController.setQty),
);

router.delete(
  "/items",
  requireCsrf,
  requireAuth,
  validate(removeFromCartSchema),
  asyncHandler(cartController.remove),
);

router.delete("/", requireCsrf, requireAuth, asyncHandler(cartController.clear));

router.post(
  "/merge",
  requireCsrf,
  requireAuth,
  validate(mergeCartSchema),
  asyncHandler(cartController.merge),
);

export default router;
