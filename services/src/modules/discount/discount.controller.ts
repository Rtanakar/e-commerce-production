// ============================================================================
// discount.controller.ts - HTTP layer for discount codes
// ============================================================================

import type { Request, Response } from "express";
import * as discountService from "./discount.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { UnauthorizedError } from "../../utils/errors.js";
import type {
  CreateDiscountDto,
  UpdateDiscountDto,
  ListDiscountsQuery,
} from "./discount.validator.js";

// GET /discounts
export async function list(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const result = await discountService.listDiscounts(
    req.user.sub,
    req.query as unknown as ListDiscountsQuery,
  );
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// POST /discounts
export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const discount = await discountService.createDiscount(
    req.user.sub,
    req.body as CreateDiscountDto,
  );
  res.status(HttpStatus.CREATED).json({
    ...ApiResponseBuilder.success({ discount }),
    requestId: req.id,
  });
}

// GET /discounts/:id
export async function getById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const discount = await discountService.getDiscount(req.user.sub, req.params.id as string);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ discount }),
    requestId: req.id,
  });
}

// PATCH /discounts/:id
export async function update(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const discount = await discountService.updateDiscount(
    req.user.sub,
    req.params.id as string,
    req.body as UpdateDiscountDto,
  );
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ discount }),
    requestId: req.id,
  });
}

// DELETE /discounts/:id
export async function remove(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  await discountService.deleteDiscount(req.user.sub, req.params.id as string);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ deleted: true }),
    requestId: req.id,
  });
}
