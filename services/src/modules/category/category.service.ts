// ============================================================================
// category.service.ts - Category business logic
// ============================================================================
// Controller (HTTP) → Service (business) → Repository (DB)
// ============================================================================

import { Prisma } from "../../generated/prisma/client.js";
import { slugify, uniqueSlugify } from "../../utils/slugify.js";
import { BadRequestError, NotFoundError } from "../../utils/errors.js";
import * as categoryRepo from "./category.repository.js";
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  ListCategoriesQuery,
} from "./category.validator.js";

// ============================================================================
// LIST - tree ya flat
// ============================================================================
export async function listCategories(query: ListCategoriesQuery) {
  if (query.shape === "tree") {
    return categoryRepo.listTree(query.includeInactive);
  }

  // flat — optional parentId filter (subcategory dropdown)
  const where: Prisma.CategoryWhereInput = {
    ...(query.includeInactive ? {} : { isActive: true }),
    ...(query.parentId !== undefined && { parentId: query.parentId }),
  };
  return categoryRepo.list(where);
}

export async function getCategoryBySlug(slug: string) {
  const category = await categoryRepo.findBySlug(slug);
  if (!category) throw new NotFoundError("Category");
  return category;
}

// ============================================================================
// CREATE - admin
// ============================================================================
export async function createCategory(input: CreateCategoryDto) {
  // parentId valid hai? (subcategory ka parent exist + top-level ho — 2 level max)
  if (input.parentId) {
    const parent = await categoryRepo.findById(input.parentId);
    if (!parent) throw new BadRequestError("Parent category not found");
    if (parent.parentId) {
      // Sirf 2 level allowed — subcategory ke under subcategory nahi
      throw new BadRequestError("Categories support only 2 levels (category → subcategory)");
    }
  }

  // Slug resolve — diya hua unique check, warna name se auto
  const slug = input.slug
    ? await ensureSlugFree(slugify(input.slug))
    : await uniqueSlugify(input.name, (s) => categoryRepo.slugExists(s));

  const data: Prisma.CategoryCreateInput = {
    name: input.name,
    slug,
    description: input.description,
    image: input.image,
    position: input.position,
    isActive: input.isActive,
    ...(input.parentId && { parent: { connect: { id: input.parentId } } }),
  };

  return categoryRepo.create(data);
}

async function ensureSlugFree(slug: string, excludeId?: string): Promise<string> {
  if (await categoryRepo.slugExists(slug, excludeId)) {
    throw new BadRequestError(`Slug "${slug}" is already taken`);
  }
  return slug;
}

// ============================================================================
// UPDATE - admin
// ============================================================================
export async function updateCategory(id: string, input: UpdateCategoryDto) {
  const existing = await categoryRepo.findById(id);
  if (!existing) throw new NotFoundError("Category");

  // parentId change — cycle/2-level guard
  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === id) throw new BadRequestError("Category cannot be its own parent");
    const parent = await categoryRepo.findById(input.parentId);
    if (!parent) throw new BadRequestError("Parent category not found");
    if (parent.parentId) throw new BadRequestError("Categories support only 2 levels");
    // Agar ye category ke khud children hain to ise subcategory nahi bana sakte
    const childCount = await categoryRepo.countChildren(id);
    if (childCount > 0) {
      throw new BadRequestError("Category has subcategories — cannot become a subcategory itself");
    }
  }

  // Slug change → uniqueness
  let slug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    slug = await ensureSlugFree(slugify(input.slug), id);
  }

  const data: Prisma.CategoryUpdateInput = {
    ...(input.name !== undefined && { name: input.name }),
    slug,
    ...(input.description !== undefined && { description: input.description }),
    ...(input.image !== undefined && { image: input.image }),
    ...(input.position !== undefined && { position: input.position }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
    ...(input.parentId !== undefined && {
      parent: input.parentId ? { connect: { id: input.parentId } } : { disconnect: true },
    }),
  };

  return categoryRepo.update(id, data);
}

// ============================================================================
// DELETE - admin (guard: linked products / children na ho)
// ============================================================================
export async function deleteCategory(id: string) {
  const existing = await categoryRepo.findById(id);
  if (!existing) throw new NotFoundError("Category");

  const [linkedProducts, children] = await Promise.all([
    categoryRepo.countLinkedProducts(id),
    categoryRepo.countChildren(id),
  ]);

  if (linkedProducts > 0) {
    throw new BadRequestError(
      `Cannot delete — ${linkedProducts} product(s) use this category. Reassign or deactivate instead.`,
    );
  }
  if (children > 0) {
    throw new BadRequestError(
      `Cannot delete — category has ${children} subcategor(y/ies). Delete those first.`,
    );
  }

  await categoryRepo.remove(id);
}
