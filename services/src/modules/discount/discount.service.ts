// ============================================================================
// discount.service.ts - Discount code business logic (seller-scoped)
// ============================================================================
// Ownership: har code ek vendor ka hota hai. Seller sirf apne codes manage
// kar sakta hai. Service vendorId resolve karke ownership enforce karta hai.
// ============================================================================

import { Prisma } from "../../generated/prisma/client.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { buildPageMeta } from "../../utils/pagination.js";
import * as vendorRepo from "../vendor/vendor.repository.js";
import * as discountRepo from "./discount.repository.js";
import type {
  CreateDiscountDto,
  UpdateDiscountDto,
  ListDiscountsQuery,
} from "./discount.validator.js";

// ============================================================================
// resolveVendorId - userId → vendorId (har seller op ke shuru me)
// ============================================================================
export async function resolveVendorId(userId: string): Promise<string> {
  const vendorId = await vendorRepo.findVendorIdByUserId(userId);
  if (!vendorId) {
    throw new ForbiddenError("Complete shop setup before managing discounts");
  }
  return vendorId;
}

// ownership guard — code mila + isi vendor ka hai
async function ensureOwned(id: string, vendorId: string) {
  const code = await discountRepo.findById(id);
  if (!code) throw new NotFoundError("Discount code");
  if (code.vendorId !== vendorId) {
    throw new ForbiddenError("You don't own this discount code");
  }
  return code;
}

// ============================================================================
// LIST
// ============================================================================
export async function listDiscounts(userId: string, query: ListDiscountsQuery) {
  const vendorId = await resolveVendorId(userId);

  const where: Prisma.DiscountCodeWhereInput = {
    vendorId,
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.search?.trim() && {
      OR: [
        { code: { contains: query.search.trim(), mode: "insensitive" } },
        { title: { contains: query.search.trim(), mode: "insensitive" } },
      ],
    }),
  };

  const { items, nextCursor, hasNextPage, totalCount } = await discountRepo.list({
    where,
    cursor: query.cursor,
    page: query.page,
    limit: query.limit,
  });

  return {
    discounts: items,
    ...buildPageMeta({
      totalCount,
      limit: query.limit,
      page: query.page,
      cursor: query.cursor,
      nextCursor,
      hasNextPage,
    }),
  };
}

// ============================================================================
// CREATE
// ============================================================================
export async function createDiscount(userId: string, input: CreateDiscountDto) {
  const vendorId = await resolveVendorId(userId);

  const code = input.code.toUpperCase(); // normalize — case-insensitive uniqueness
  if (await discountRepo.codeTaken(vendorId, code)) {
    throw new BadRequestError(`Discount code "${code}" already exists in your shop`);
  }

  const data: Prisma.DiscountCodeCreateInput = {
    vendor: { connect: { id: vendorId } },
    code,
    title: input.title,
    type: input.type,
    value: input.value,
    minOrder: input.minOrder ?? null,
    maxUses: input.maxUses ?? null,
    perUserLimit: input.perUserLimit ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    isActive: input.isActive,
  };

  return discountRepo.create(data);
}

// ============================================================================
// GET single
// ============================================================================
export async function getDiscount(userId: string, id: string) {
  const vendorId = await resolveVendorId(userId);
  return ensureOwned(id, vendorId);
}

// ============================================================================
// UPDATE
// ============================================================================
export async function updateDiscount(userId: string, id: string, input: UpdateDiscountDto) {
  const vendorId = await resolveVendorId(userId);
  const existing = await ensureOwned(id, vendorId);

  // code change → uniqueness
  let code = existing.code;
  if (input.code && input.code.toUpperCase() !== existing.code) {
    code = input.code.toUpperCase();
    if (await discountRepo.codeTaken(vendorId, code, id)) {
      throw new BadRequestError(`Discount code "${code}" already exists in your shop`);
    }
  }

  // PERCENT value range re-check (partial update PERCENT pe bhi guard)
  const finalType = input.type ?? existing.type;
  const finalValue = input.value ?? existing.value;
  if (finalType === "PERCENT" && finalValue > 100) {
    throw new BadRequestError("PERCENT discount value must be between 1 and 100");
  }

  const data: Prisma.DiscountCodeUpdateInput = {
    code,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.type !== undefined && { type: input.type }),
    ...(input.value !== undefined && { value: input.value }),
    ...(input.minOrder !== undefined && { minOrder: input.minOrder }),
    ...(input.maxUses !== undefined && { maxUses: input.maxUses }),
    ...(input.perUserLimit !== undefined && { perUserLimit: input.perUserLimit }),
    ...(input.startsAt !== undefined && { startsAt: input.startsAt }),
    ...(input.endsAt !== undefined && { endsAt: input.endsAt }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  };

  return discountRepo.update(id, data);
}

// ============================================================================
// DELETE - relation (product-discount) auto-disconnect (M:N implicit)
// ============================================================================
export async function deleteDiscount(userId: string, id: string) {
  const vendorId = await resolveVendorId(userId);
  await ensureOwned(id, vendorId);
  await discountRepo.remove(id);
}
