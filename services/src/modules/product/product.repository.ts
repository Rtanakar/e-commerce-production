// ============================================================================
// product.repository.ts - DB access for products (NO business logic)
// ============================================================================
// Service Prisma data shape banata hai, repo bas execute karta hai. Nested
// writes (images/variants/discountCodes) yahin handle hote hain transactions
// ke saath taaki product + uske children atomic rahein.
// ============================================================================

import { prisma } from "../../db/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { buildCursorArgs, processCursorPage } from "../../utils/pagination.js";

// ============================================================================
// Card projection - list rows (full product payload bhaari hota hai)
// ============================================================================
const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  brand: true,
  status: true,
  currency: true,
  regularPrice: true,
  salePrice: true,
  discountPercent: true,
  stock: true,
  ratingAvg: true,
  ratingCount: true,
  soldCount: true,
  createdAt: true,
  deletedAt: true, // soft-delete timestamp — frontend "Deleted" badge
  purgeAt: true, // 24h purge deadline — frontend countdown ("23h left")
  // primary image — isPrimary pehle, fir position; sirf ek card ke liye
  images: {
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
    take: 1,
    select: { url: true, alt: true },
  },
} as const satisfies Prisma.ProductSelect;

// Storefront card projection — public listing (multiple images + color variants
// taaki frontend pe hover thumbnail strip + variant swatches dikhein, Amazon style)
const STOREFRONT_SELECT = {
  id: true,
  slug: true,
  title: true,
  brand: true,
  shortDescription: true,
  status: true,
  currency: true,
  regularPrice: true,
  salePrice: true,
  discountPercent: true,
  stock: true,
  ratingAvg: true,
  ratingCount: true,
  soldCount: true,
  createdAt: true,
  colors: true, // base product ke hex colors — default swatch ka actual color (image nahi)
  bannerUrl: true, // seller ne create-time "Banner (optional)" upload kiya — hero carousel
  // saari product-level gallery images (variantId null) — hover strip ke liye
  images: {
    where: { variantId: null },
    orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
    select: { url: true, alt: true },
  },
  // color variants (apni image ke saath) — card pe swatch + switch
  variants: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      color: true,
      price: true,
      stock: true,
      images: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
    },
  },
  category: { select: { id: true, name: true, slug: true } },
  subcategory: { select: { id: true, name: true, slug: true } },
} as const satisfies Prisma.ProductSelect;

// Full detail include — single product (edit form / public detail page)
const FULL_INCLUDE = {
  images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
  variants: {
    orderBy: { position: "asc" },
    include: { images: { orderBy: { position: "asc" } } },
  },
  discountCodes: true,
  category: { select: { id: true, name: true, slug: true } },
  subcategory: { select: { id: true, name: true, slug: true } },
} as const satisfies Prisma.ProductInclude;

// ============================================================================
// Slug uniqueness
// ============================================================================
export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const row = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!row) return false;
  return excludeId ? row.id !== excludeId : true;
}

// ============================================================================
// Lookups
// ============================================================================
// Light — ownership/lifecycle checks (vendorId + status + media keys for cleanup)
export async function findByIdLight(id: string) {
  return prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      vendorId: true,
      status: true,
      publishedAt: true,
      slug: true,
      bannerUrl: true,
      videoUrl: true,
      description: true,
      images: { select: { key: true, url: true } },
      variants: { select: { images: { select: { key: true, url: true } } } },
    },
  });
}

export async function findByIdFull(id: string) {
  return prisma.product.findUnique({ where: { id }, include: FULL_INCLUDE });
}

export async function findBySlugFull(slug: string) {
  return prisma.product.findUnique({ where: { slug }, include: FULL_INCLUDE });
}

// ============================================================================
// list - cursor + offset hybrid
// ============================================================================
export async function list(params: {
  where: Prisma.ProductWhereInput;
  orderBy: Prisma.ProductOrderByWithRelationInput[];
  cursor?: string | null;
  page: number;
  limit: number;
  // "storefront" → rich card (images + variants); default seller light card
  variant?: "seller" | "storefront";
}) {
  const { where, orderBy, cursor, page, limit, variant = "seller" } = params;
  const select = variant === "storefront" ? STOREFRONT_SELECT : CARD_SELECT;

  const [rows, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      select,
      ...buildCursorArgs({ cursor, page, limit }),
    }),
    prisma.product.count({ where }),
  ]);

  return { ...processCursorPage(rows, limit), totalCount };
}

// ============================================================================
// create - product + nested images/variants + discount connect (atomic)
// ============================================================================
export async function create(data: Prisma.ProductCreateInput) {
  return prisma.product.create({ data, include: FULL_INCLUDE });
}

// ============================================================================
// update - scalar/relation fields (images/variants service me replace karta)
// ============================================================================
export async function update(id: string, data: Prisma.ProductUpdateInput) {
  return prisma.product.update({ where: { id }, data, include: FULL_INCLUDE });
}

// ============================================================================
// replaceImages - product-level gallery atomically replace
// ============================================================================
// Edit pe puri gallery overwrite — purani delete, nayi create. Ek transaction.
// (variantId null wali product-level images hi target karte hain.)
// ============================================================================
export async function replaceImages(
  productId: string,
  images: Prisma.ProductImageCreateManyProductInput[],
) {
  return prisma.$transaction([
    prisma.productImage.deleteMany({ where: { productId, variantId: null } }),
    ...(images.length
      ? [prisma.productImage.createMany({ data: images.map((i) => ({ ...i, productId })) })]
      : []),
  ]);
}

// ============================================================================
// replaceVariants - variants + unki images atomically replace
// ============================================================================
export async function replaceVariants(
  productId: string,
  variants: Array<{
    data: Omit<Prisma.ProductVariantCreateInput, "product" | "images">;
    images: Prisma.ProductImageCreateWithoutVariantInput[];
  }>,
) {
  return prisma.$transaction(async (tx) => {
    // Variant delete → cascade se uski images bhi delete (onDelete: Cascade)
    await tx.productVariant.deleteMany({ where: { productId } });
    for (const v of variants) {
      await tx.productVariant.create({
        data: {
          ...v.data,
          product: { connect: { id: productId } },
          // Variant images sirf variantId se bandhti hain (productId NAHI —
          // warna woh product gallery me bhi dikhne lagti)
          ...(v.images.length && { images: { create: v.images } }),
        },
      });
    }
  });
}

// ============================================================================
// setDiscountCodes - M:N relation set (replace all)
// ============================================================================
export async function setDiscountCodes(productId: string, codeIds: string[]) {
  return prisma.product.update({
    where: { id: productId },
    data: { discountCodes: { set: codeIds.map((id) => ({ id })) } },
  });
}

// ============================================================================
// delete - hard delete (cascade images/variants; M:N rows auto-clear)
// ============================================================================
export async function remove(id: string) {
  return prisma.product.delete({ where: { id } });
}

// ============================================================================
// findDueForPurge - soft-deleted products jinka 24h window khatam (purge cron)
// ============================================================================
// status=DELETED + purgeAt <= now. Media keys saath laate hain taaki R2/S3
// cleanup ho sake (extractProductKeys ke liye same shape jaisa findByIdLight).
// ============================================================================
export async function findDueForPurge(now: Date, take = 100) {
  return prisma.product.findMany({
    where: { status: "DELETED", purgeAt: { not: null, lte: now } },
    take,
    select: {
      id: true,
      bannerUrl: true,
      videoUrl: true,
      description: true,
      images: { select: { key: true, url: true } },
      variants: { select: { images: { select: { key: true, url: true } } } },
    },
  });
}

// ============================================================================
// incrementView - public detail page hit (fire-and-forget)
// ============================================================================
export async function incrementView(id: string) {
  return prisma.product.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
    select: { id: true },
  });
}

// vendor ke valid discount code ids filter — ownership enforce
export async function filterOwnedDiscountIds(vendorId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.discountCode.findMany({
    where: { vendorId, id: { in: ids } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// category exist + active check (id se)
export async function categoryExists(id: string): Promise<boolean> {
  const row = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  return !!row;
}
