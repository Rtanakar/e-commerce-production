// ============================================================================
// product.controller.ts - HTTP layer for products
// ============================================================================
// Public reads (storefront) + seller writes (dashboard). req.user.sub = userId,
// req.user.role = role. Ownership service layer me enforce hota hai.
// ============================================================================

import type { Request, Response } from "express";
import * as productService from "./product.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { UnauthorizedError } from "../../utils/errors.js";
import type { CreateProductDto, UpdateProductDto, ListProductsQuery } from "./product.validator.js";

// helper — req.user se {id, role}
function authUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return { id: req.user.sub, role: req.user.role };
}

// ============================================================================
// PUBLIC
// ============================================================================

// GET /products - storefront listing (ACTIVE only)
export async function listPublic(req: Request, res: Response): Promise<void> {
  const result = await productService.listPublicProducts(req.query as unknown as ListProductsQuery);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// GET /products/:slug - public detail
export async function getBySlug(req: Request, res: Response): Promise<void> {
  const product = await productService.getProductBySlug(req.params.slug as string);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ product }),
    requestId: req.id,
  });
}

// ============================================================================
// SELLER
// ============================================================================

// GET /products/seller/mine - seller "All Products"
export async function listMine(req: Request, res: Response): Promise<void> {
  const user = authUser(req);
  const result = await productService.listVendorProducts(
    user.id,
    req.query as unknown as ListProductsQuery,
  );
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// GET /products/seller/:id - seller edit-form fetch (DRAFT visible)
export async function getMineById(req: Request, res: Response): Promise<void> {
  const user = authUser(req);
  const product = await productService.getProductForOwner(req.params.id as string, user);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ product }),
    requestId: req.id,
  });
}

// POST /products - create
export async function create(req: Request, res: Response): Promise<void> {
  const user = authUser(req);
  const product = await productService.createProduct(req.body as CreateProductDto, user.id);
  res.status(HttpStatus.CREATED).json({
    ...ApiResponseBuilder.success({ product }),
    requestId: req.id,
  });
}

// PATCH /products/:id - update
export async function update(req: Request, res: Response): Promise<void> {
  const user = authUser(req);
  const product = await productService.updateProduct(
    req.params.id as string,
    req.body as UpdateProductDto,
    user,
  );
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ product }),
    requestId: req.id,
  });
}

// POST /products/:id/archive - soft delete
export async function archive(req: Request, res: Response): Promise<void> {
  const user = authUser(req);
  const product = await productService.archiveProduct(req.params.id as string, user);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ product, message: "Product archived" }),
    requestId: req.id,
  });
}

// POST /products/:id/restore - ARCHIVED → DRAFT
export async function restore(req: Request, res: Response): Promise<void> {
  const user = authUser(req);
  const product = await productService.restoreProduct(req.params.id as string, user);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ product, message: "Product restored to draft" }),
    requestId: req.id,
  });
}

// DELETE /products/:id - soft delete (DELETED state, 24h recovery)
export async function remove(req: Request, res: Response): Promise<void> {
  const user = authUser(req);
  const product = await productService.softDeleteProduct(req.params.id as string, user);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      deleted: true,
      product,
      message: "Product moved to delete state — recover within 24 hours",
    }),
    requestId: req.id,
  });
}
