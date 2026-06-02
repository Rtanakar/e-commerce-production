// ============================================================================
// wishlist.controller.ts - HTTP layer for customer wishlist
// ============================================================================

import type { Request, Response } from "express";
import * as wishlistService from "./wishlist.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { UnauthorizedError } from "../../utils/errors.js";
import type {
  AddToWishlistDto,
  RemoveFromWishlistDto,
  MergeWishlistDto,
} from "./wishlist.validator.js";

function userId(req: Request): string {
  if (!req.user) throw new UnauthorizedError();
  return req.user.sub;
}

// GET /wishlist
export async function get(req: Request, res: Response): Promise<void> {
  const wl = await wishlistService.getWishlist(userId(req));
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(wl), requestId: req.id });
}

// GET /wishlist/count
export async function count(req: Request, res: Response): Promise<void> {
  const result = await wishlistService.getCount(userId(req));
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(result), requestId: req.id });
}

// GET /wishlist/ids — frontend hydration ("is wishlisted")
export async function ids(req: Request, res: Response): Promise<void> {
  const result = await wishlistService.getProductIds(userId(req));
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(result), requestId: req.id });
}

// POST /wishlist/toggle — heart click (add ya remove)
export async function toggle(req: Request, res: Response): Promise<void> {
  const result = await wishlistService.toggleWishlist(userId(req), req.body as AddToWishlistDto);
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(result), requestId: req.id });
}

// POST /wishlist/items — explicit add
export async function add(req: Request, res: Response): Promise<void> {
  const wl = await wishlistService.addToWishlist(userId(req), req.body as AddToWishlistDto);
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(wl), requestId: req.id });
}

// DELETE /wishlist/items — explicit remove
export async function remove(req: Request, res: Response): Promise<void> {
  const wl = await wishlistService.removeFromWishlist(userId(req), req.body as RemoveFromWishlistDto);
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(wl), requestId: req.id });
}

// POST /wishlist/merge — guest wishlist on login
export async function merge(req: Request, res: Response): Promise<void> {
  const wl = await wishlistService.mergeWishlist(userId(req), req.body as MergeWishlistDto);
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(wl), requestId: req.id });
}
