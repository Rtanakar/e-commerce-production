// ============================================================================
// pagination.ts - Cursor + offset hybrid pagination helpers
// ============================================================================
// "Dynamically increase with products" requirement: cursor pagination. Jaise
// jaise products badhte hain client `nextCursor` bhejta hai aur DB seedha us
// point ke baad rows nikaalta hai — koi SKIP nahi, koi drift nahi (stable even
// jab beech me naya product insert ho jaaye).
//
// Backward compat: cursor na aaye aur page > 1 → purana offset skip fallback.
//
// Kaise kaam karta hai (employee/course module ka same battle-tested pattern):
//   1. `take = limit + 1` rows fetch — extra row = "next page exists" signal
//   2. Stable orderBy: [primary, { id: "desc" }] — id tie-breaker zaroori,
//      warna same createdAt wale rows pe cursor drift karta hai
//   3. Last visible item ka id = nextCursor
// ============================================================================

// ============================================================================
// buildCursorArgs - Prisma findMany ke take/cursor/skip args
// ============================================================================
// Spread karke findMany me daalo:
//   prisma.x.findMany({ where, orderBy, ...buildCursorArgs({cursor,page,limit}) })
// ============================================================================
export function buildCursorArgs(params: { cursor?: string | null; page: number; limit: number }): {
  take: number;
  cursor?: { id: string };
  skip?: number;
} {
  const { cursor, page, limit } = params;
  return {
    take: limit + 1, // +1 → next page detect
    ...(cursor
      ? { cursor: { id: cursor }, skip: 1 } // cursor row khud skip
      : page > 1
        ? { skip: (page - 1) * limit } // offset fallback
        : {}),
  };
}

// ============================================================================
// processCursorPage - fetched rows ko page + nextCursor me todo
// ============================================================================
export function processCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null; hasNextPage: boolean } {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? (items.at(-1)?.id ?? null) : null;
  return { items, nextCursor, hasNextPage };
}

// ============================================================================
// buildPageMeta - response meta (cursor + offset dono fields)
// ============================================================================
export function buildPageMeta(params: {
  totalCount: number;
  limit: number;
  page: number;
  cursor?: string | null;
  nextCursor: string | null;
  hasNextPage: boolean;
}) {
  const { totalCount, limit, page, cursor, nextCursor, hasNextPage } = params;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  return {
    nextCursor,
    totalCount,
    totalPages,
    hasNextPage,
    // cursor mode → previous exists if cursor bheja; offset mode → page > 1
    hasPreviousPage: Boolean(cursor) || page > 1,
    page,
    limit,
  };
}
