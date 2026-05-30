// ============================================================================
// discount.repository.ts - DB access for discount codes
// ============================================================================

import { prisma } from "../../db/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { buildCursorArgs, processCursorPage } from "../../utils/pagination.js";

export async function findById(id: string) {
  return prisma.discountCode.findUnique({ where: { id } });
}

// code per-vendor unique — create/update se pehle check
export async function codeTaken(
  vendorId: string,
  code: string,
  excludeId?: string,
): Promise<boolean> {
  const row = await prisma.discountCode.findUnique({
    where: { vendorId_code: { vendorId, code } },
    select: { id: true },
  });
  if (!row) return false;
  return excludeId ? row.id !== excludeId : true;
}

// ============================================================================
// list - cursor + offset hybrid, vendor-scoped
// ============================================================================
export async function list(params: {
  where: Prisma.DiscountCodeWhereInput;
  cursor?: string | null;
  page: number;
  limit: number;
}) {
  const { where, cursor, page, limit } = params;

  const [rows, totalCount] = await Promise.all([
    prisma.discountCode.findMany({
      where,
      // id tie-breaker → stable cursor (same createdAt collision safe)
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...buildCursorArgs({ cursor, page, limit }),
    }),
    prisma.discountCode.count({ where }),
  ]);

  return { ...processCursorPage(rows, limit), totalCount };
}

export async function create(data: Prisma.DiscountCodeCreateInput) {
  return prisma.discountCode.create({ data });
}

export async function update(id: string, data: Prisma.DiscountCodeUpdateInput) {
  return prisma.discountCode.update({ where: { id }, data });
}

export async function remove(id: string) {
  return prisma.discountCode.delete({ where: { id } });
}
