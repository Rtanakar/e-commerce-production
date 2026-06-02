// ============================================================================
// wishlist.routes.ts - Customer wishlist endpoints (customer cookie jar)
// ============================================================================
//   GET    /api/v1/wishlist          → full list
//   GET    /api/v1/wishlist/count    → count (header badge)
//   GET    /api/v1/wishlist/ids      → product/variant ids (hydration)
//   POST   /api/v1/wishlist/toggle   → heart click (add/remove)
//   POST   /api/v1/wishlist/items    → explicit add
//   DELETE /api/v1/wishlist/items    → explicit remove
//   POST   /api/v1/wishlist/merge    → merge guest wishlist on login
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { requireCsrf } from "../../middlewares/csrf.js";
import * as wishlistController from "./wishlist.controller.js";
import {
  addToWishlistSchema,
  removeFromWishlistSchema,
  mergeWishlistSchema,
} from "./wishlist.validator.js";

const router: Router = Router();

router.get("/", requireAuth, asyncHandler(wishlistController.get));
router.get("/count", requireAuth, asyncHandler(wishlistController.count));
router.get("/ids", requireAuth, asyncHandler(wishlistController.ids));

router.post(
  "/toggle",
  requireCsrf,
  requireAuth,
  validate(addToWishlistSchema),
  asyncHandler(wishlistController.toggle),
);

router.post(
  "/items",
  requireCsrf,
  requireAuth,
  validate(addToWishlistSchema),
  asyncHandler(wishlistController.add),
);

router.delete(
  "/items",
  requireCsrf,
  requireAuth,
  validate(removeFromWishlistSchema),
  asyncHandler(wishlistController.remove),
);

router.post(
  "/merge",
  requireCsrf,
  requireAuth,
  validate(mergeWishlistSchema),
  asyncHandler(wishlistController.merge),
);

export default router;
