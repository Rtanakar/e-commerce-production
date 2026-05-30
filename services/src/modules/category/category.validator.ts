// ============================================================================
// category.validator.ts - Zod schemas for category taxonomy
// ============================================================================
// Category admin-managed hai (taxonomy tree). Seller sirf list read karke
// product pe choose karta hai. parentId se subcategory banti hai.
// ============================================================================

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================================
// CREATE
// ============================================================================
export const createCategorySchema = z
  .object({
    name: z.string().min(2).max(60).trim(),
    // slug optional — na do to name se auto-generate hoga
    slug: z.string().min(2).max(80).trim().optional(),
    description: z.string().max(500).trim().optional(),
    image: z.string().url().optional(),
    position: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
    // parentId set → ye ek subcategory hai
    parentId: z.string().cuid().optional().nullable(),
  })
  .openapi("CreateCategoryRequest");

// ============================================================================
// UPDATE - partial
// ============================================================================
export const updateCategorySchema = z
  .object({
    name: z.string().min(2).max(60).trim().optional(),
    slug: z.string().min(2).max(80).trim().optional(),
    description: z.string().max(500).trim().optional().nullable(),
    image: z.string().url().optional().nullable(),
    position: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    parentId: z.string().cuid().optional().nullable(),
  })
  .openapi("UpdateCategoryRequest");

// ============================================================================
// LIST query - filter active, optionally only top-level / only children
// ============================================================================
export const listCategoriesSchema = z.object({
  // "all" admin ke liye, public default sirf active
  includeInactive: z.coerce.boolean().default(false),
  // tree → nested children ke saath, flat → ek hi array
  shape: z.enum(["tree", "flat"]).default("tree"),
  // sirf is parent ke children (subcategory dropdown ke liye)
  parentId: z.string().cuid().optional(),
});

// params
export const categoryIdParam = z.object({ id: z.string().cuid() });
export const categorySlugParam = z.object({ slug: z.string().min(1) });

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesSchema>;
