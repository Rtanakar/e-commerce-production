// ============================================================================
// category.repository.ts - DB access for categories (no business logic)
// ============================================================================

import { prisma } from "../../db/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const row = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!row) return false;
  return excludeId ? row.id !== excludeId : true;
}

export async function findById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export async function findBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: { children: { where: { isActive: true }, orderBy: { position: "asc" } } },
  });
}

// ============================================================================
// list - flat list with optional filters
// ============================================================================
export async function list(where: Prisma.CategoryWhereInput) {
  return prisma.category.findMany({
    where,
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

// ============================================================================
// listTree - top-level categories with nested children (2 levels)
// ============================================================================
// Dropdown UI: Category select → Subcategory select. 2 level kaafi hai.
// ============================================================================
export async function listTree(includeInactive: boolean) {
  const activeFilter = includeInactive ? {} : { isActive: true };
  return prisma.category.findMany({
    where: { parentId: null, ...activeFilter },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      children: {
        where: activeFilter,
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
    },
  });
}

export async function create(data: Prisma.CategoryCreateInput) {
  return prisma.category.create({ data });
}

export async function update(id: string, data: Prisma.CategoryUpdateInput) {
  return prisma.category.update({ where: { id }, data });
}

export async function remove(id: string) {
  return prisma.category.delete({ where: { id } });
}

// Kitne products is category (ya iske children) se linked? delete guard ke liye
export async function countLinkedProducts(id: string): Promise<number> {
  return prisma.product.count({
    where: { OR: [{ categoryId: id }, { subcategoryId: id }] },
  });
}

export async function countChildren(id: string): Promise<number> {
  return prisma.category.count({ where: { parentId: id } });
}
