// ============================================================================
// cart.controller.ts - HTTP layer for customer cart
// ============================================================================
// Customer cookie jar (requireAuth). req.user.sub = userId.
// ============================================================================

import type { Request, Response } from "express";
import * as cartService from "./cart.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { UnauthorizedError } from "../../utils/errors.js";
import type { AddToCartDto, SetQtyDto, RemoveFromCartDto, MergeCartDto } from "./cart.validator.js";

function userId(req: Request): string {
  if (!req.user) throw new UnauthorizedError();
  return req.user.sub;
}

// GET /cart
export async function get(req: Request, res: Response): Promise<void> {
  const cart = await cartService.getCart(userId(req));
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(cart), requestId: req.id });
}

// GET /cart/count — header badge
export async function count(req: Request, res: Response): Promise<void> {
  const result = await cartService.getCount(userId(req));
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(result), requestId: req.id });
}

// POST /cart/items — add / increment
export async function add(req: Request, res: Response): Promise<void> {
  const cart = await cartService.addToCart(userId(req), req.body as AddToCartDto);
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(cart), requestId: req.id });
}

// PATCH /cart/items — absolute quantity set (0 = remove)
export async function setQty(req: Request, res: Response): Promise<void> {
  const cart = await cartService.setQuantity(userId(req), req.body as SetQtyDto);
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(cart), requestId: req.id });
}

// DELETE /cart/items — remove one line
export async function remove(req: Request, res: Response): Promise<void> {
  const cart = await cartService.removeFromCart(userId(req), req.body as RemoveFromCartDto);
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(cart), requestId: req.id });
}

// DELETE /cart — clear all
export async function clear(req: Request, res: Response): Promise<void> {
  const cart = await cartService.clearCart(userId(req));
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(cart), requestId: req.id });
}

// POST /cart/merge — guest cart (localStorage) → server on login
export async function merge(req: Request, res: Response): Promise<void> {
  const cart = await cartService.mergeCart(userId(req), req.body as MergeCartDto);
  res.status(HttpStatus.OK).json({ ...ApiResponseBuilder.success(cart), requestId: req.id });
}
