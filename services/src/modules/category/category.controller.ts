// ============================================================================
// category.controller.ts - HTTP layer for categories
// ============================================================================

import type { Request, Response } from "express";
import * as categoryService from "./category.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  ListCategoriesQuery,
} from "./category.validator.js";

// GET /categories
export async function list(req: Request, res: Response): Promise<void> {
  const items = await categoryService.listCategories(req.query as unknown as ListCategoriesQuery);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ categories: items }),
    requestId: req.id,
  });
}

// GET /categories/:slug
export async function getBySlug(req: Request, res: Response): Promise<void> {
  const category = await categoryService.getCategoryBySlug(req.params.slug as string);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ category }),
    requestId: req.id,
  });
}

// POST /categories (admin)
export async function create(req: Request, res: Response): Promise<void> {
  const category = await categoryService.createCategory(req.body as CreateCategoryDto);
  res.status(HttpStatus.CREATED).json({
    ...ApiResponseBuilder.success({ category }),
    requestId: req.id,
  });
}

// PATCH /categories/:id (admin)
export async function update(req: Request, res: Response): Promise<void> {
  const category = await categoryService.updateCategory(
    req.params.id as string,
    req.body as UpdateCategoryDto,
  );
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ category }),
    requestId: req.id,
  });
}

// DELETE /categories/:id (admin)
export async function remove(req: Request, res: Response): Promise<void> {
  await categoryService.deleteCategory(req.params.id as string);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ deleted: true }),
    requestId: req.id,
  });
}
