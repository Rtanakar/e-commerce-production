// ============================================================================
// product.service.ts - Product business logic
// ============================================================================
// Controller (HTTP) → Service (business) → Repository (DB)
//
// Responsibilities:
//   - Slug uniqueness + auto-generate
//   - Discount % auto-compute (cached column)
//   - Ownership gates (seller owns product / admin overrides)
//   - Lifecycle (DRAFT → ACTIVE publishedAt once, archive/restore)
//   - Category + discount-code ownership validation
//   - R2/S3 media cleanup on hard delete
// ============================================================================

import { Prisma } from "../../generated/prisma/client.js";
import { slugify, uniqueSlugify } from "../../utils/slugify.js";
import { buildPageMeta } from "../../utils/pagination.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { keyFromPublicUrl, deleteObjects } from "../../lib/storage.js";
import { logger } from "../../utils/logger.js";
import * as vendorRepo from "../vendor/vendor.repository.js";
import * as productRepo from "./product.repository.js";
import type {
  CreateProductDto,
  UpdateProductDto,
  ListProductsQuery,
  ProductImageInput,
  ProductVariantInput,
} from "./product.validator.js";

type AuthUser = { id: string; role: string };

// ============================================================================
// Helpers
// ============================================================================

/** MRP/sale se discount % compute — cached discountPercent column ke liye. */
function computeDiscount(salePrice: number, regularPrice: number): number {
  if (regularPrice <= 0 || salePrice >= regularPrice) return 0;
  return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
}

/** userId → vendorId, warna 403 (shop setup zaroori). */
async function resolveVendorId(userId: string): Promise<string> {
  const vendorId = await vendorRepo.findVendorIdByUserId(userId);
  if (!vendorId) {
    throw new ForbiddenError("Complete shop setup before managing products");
  }
  return vendorId;
}

/** Search WHERE — title/brand/shortDescription/slug + tag containment. */
function buildSearchWhere(q?: string): Prisma.ProductWhereInput {
  if (!q?.trim()) return {};
  const term = q.trim();
  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { brand: { contains: term, mode: "insensitive" } },
      { shortDescription: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
      { tags: { has: term } },
    ],
  };
}

/** Sort enum → Prisma orderBy (id tie-breaker hamesha — stable cursor). */
function buildOrderBy(sort: ListProductsQuery["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "price-asc":
      return [{ salePrice: "asc" }, { id: "desc" }];
    case "price-desc":
      return [{ salePrice: "desc" }, { id: "desc" }];
    case "popular":
      return [{ soldCount: "desc" }, { id: "desc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { id: "desc" }];
    case "discount":
      return [{ discountPercent: "desc" }, { id: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

/** Price range filter (minor units). */
function buildPriceWhere(min?: number, max?: number): Prisma.ProductWhereInput {
  if (min === undefined && max === undefined) return {};
  return {
    salePrice: {
      ...(min !== undefined && { gte: min }),
      ...(max !== undefined && { lte: max }),
    },
  };
}

/** Validate category (+ optional subcategory) exist before linking. */
async function validateCategory(categoryId: string, subcategoryId?: string | null) {
  if (!(await productRepo.categoryExists(categoryId))) {
    throw new BadRequestError("Selected category does not exist");
  }
  if (subcategoryId && !(await productRepo.categoryExists(subcategoryId))) {
    throw new BadRequestError("Selected subcategory does not exist");
  }
}

/** Image DTO → Prisma nested create input. */
function toImageCreate(img: ProductImageInput): Prisma.ProductImageCreateWithoutProductInput {
  return {
    url: img.url,
    key: img.key,
    alt: img.alt,
    isPrimary: img.isPrimary,
    position: img.position,
    width: img.width,
    height: img.height,
    sizeBytes: img.sizeBytes,
  };
}

/** Variant DTO → { data, images } for repo.replaceVariants / nested create. */
function toVariantParts(v: ProductVariantInput) {
  return {
    data: {
      title: v.title,
      color: v.color,
      tags: v.tags,
      sku: v.sku,
      price: v.price ?? null,
      stock: v.stock,
      position: v.position,
    },
    images: v.images.map(
      (img): Prisma.ProductImageCreateWithoutVariantInput => ({
        url: img.url,
        key: img.key,
        alt: img.alt,
        isPrimary: img.isPrimary,
        position: img.position,
        width: img.width,
        height: img.height,
        sizeBytes: img.sizeBytes,
      }),
    ),
  };
}

// ============================================================================
// Ownership guard - reused by all seller write ops
// ============================================================================
// ADMIN → koi bhi product. VENDOR → sirf apne (vendorId match).
// Returns the light product row (keys for cleanup, status for transitions).
// ============================================================================
async function ensureOwnership(productId: string, user: AuthUser) {
  const product = await productRepo.findByIdLight(productId);
  if (!product) throw new NotFoundError("Product");

  if (user.role !== "ADMIN") {
    const vendorId = await resolveVendorId(user.id);
    if (product.vendorId !== vendorId) {
      throw new ForbiddenError("You don't own this product");
    }
  }
  return product;
}

// ============================================================================
// LIST - public (storefront) — sirf ACTIVE, no vendor scope
// ============================================================================
export async function listPublicProducts(query: ListProductsQuery) {
  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.subcategoryId && { subcategoryId: query.subcategoryId }),
    ...(query.tag && { tags: { has: query.tag } }),
    ...(query.brand && { brand: { equals: query.brand, mode: "insensitive" } }),
    ...(query.inStock && { stock: { gt: 0 } }),
    ...buildPriceWhere(query.minPrice, query.maxPrice),
    ...buildSearchWhere(query.search),
  };

  return runList(where, query);
}

// ============================================================================
// LIST - seller "All Products" — vendor-scoped, status filter allowed
// ============================================================================
export async function listVendorProducts(userId: string, query: ListProductsQuery) {
  const vendorId = await resolveVendorId(userId);

  // status filter normalize (single ya array)
  const statusFilter = query.status
    ? Array.isArray(query.status)
      ? { in: query.status }
      : query.status
    : undefined;

  const where: Prisma.ProductWhereInput = {
    vendorId,
    ...(statusFilter && { status: statusFilter }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.subcategoryId && { subcategoryId: query.subcategoryId }),
    ...(query.tag && { tags: { has: query.tag } }),
    ...(query.inStock && { stock: { gt: 0 } }),
    ...buildPriceWhere(query.minPrice, query.maxPrice),
    ...buildSearchWhere(query.search),
  };

  return runList(where, query);
}

// shared list runner
async function runList(where: Prisma.ProductWhereInput, query: ListProductsQuery) {
  const { items, nextCursor, hasNextPage, totalCount } = await productRepo.list({
    where,
    orderBy: buildOrderBy(query.sort),
    cursor: query.cursor,
    page: query.page,
    limit: query.limit,
  });

  return {
    products: items,
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
// GET by slug - public detail (view increment, fire-and-forget)
// ============================================================================
export async function getProductBySlug(slug: string) {
  const product = await productRepo.findBySlugFull(slug);
  if (!product || product.status === "ARCHIVED" || product.deletedAt) {
    throw new NotFoundError("Product");
  }
  // View count badhana — failure ignore (analytics non-critical)
  productRepo.incrementView(product.id).catch(() => {});
  return product;
}

// ============================================================================
// GET by id - seller/admin (edit form ke liye, DRAFT bhi visible)
// ============================================================================
export async function getProductForOwner(id: string, user: AuthUser) {
  await ensureOwnership(id, user);
  return productRepo.findByIdFull(id);
}

// ============================================================================
// CREATE
// ============================================================================
export async function createProduct(input: CreateProductDto, userId: string) {
  const vendorId = await resolveVendorId(userId);

  await validateCategory(input.categoryId, input.subcategoryId);

  // Slug — diya hua unique check, warna title se auto
  let slug: string;
  if (input.slug) {
    slug = slugify(input.slug);
    if (await productRepo.slugExists(slug)) {
      throw new BadRequestError(`Slug "${slug}" is already taken`);
    }
  } else {
    slug = await uniqueSlugify(input.title, (s) => productRepo.slugExists(s));
  }

  // Discount codes — sirf vendor ke apne ids accept
  const ownedDiscountIds = await productRepo.filterOwnedDiscountIds(
    vendorId,
    input.discountCodeIds,
  );

  const discountPercent = computeDiscount(input.salePrice, input.regularPrice);

  const data: Prisma.ProductCreateInput = {
    vendor: { connect: { id: vendorId } },
    slug,
    title: input.title,
    brand: input.brand,
    shortDescription: input.shortDescription,
    description: input.description,
    warranty: input.warranty,
    videoUrl: input.videoUrl,
    category: { connect: { id: input.categoryId } },
    ...(input.subcategoryId && {
      subcategory: { connect: { id: input.subcategoryId } },
    }),
    tags: input.tags,
    colors: input.colors,
    sizes: input.sizes,
    currency: input.currency,
    regularPrice: input.regularPrice,
    salePrice: input.salePrice,
    discountPercent,
    stock: input.stock,
    cashOnDelivery: input.cashOnDelivery,
    specifications: input.specifications as unknown as Prisma.InputJsonValue,
    bannerUrl: input.bannerUrl,
    status: input.status,
    publishedAt: input.status === "ACTIVE" ? new Date() : null,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    // Nested gallery images (product-level)
    ...(input.images.length && {
      images: { create: input.images.map(toImageCreate) },
    }),
    // Nested variants (+ unki images)
    ...(input.variants.length && {
      variants: {
        create: input.variants.map((v) => {
          const { data: vData, images } = toVariantParts(v);
          return {
            ...vData,
            ...(images.length && { images: { create: images } }),
          };
        }),
      },
    }),
    // M:N discount connect
    ...(ownedDiscountIds.length && {
      discountCodes: { connect: ownedDiscountIds.map((id) => ({ id })) },
    }),
  };

  return productRepo.create(data);
}

// ============================================================================
// UPDATE - PATCH (arrays diye to replace, na diye to unchanged)
// ============================================================================
export async function updateProduct(id: string, input: UpdateProductDto, user: AuthUser) {
  const existing = await ensureOwnership(id, user);

  // Category/subcategory change — sirf jo diya gaya wahi validate
  if (input.categoryId && !(await productRepo.categoryExists(input.categoryId))) {
    throw new BadRequestError("Selected category does not exist");
  }
  if (input.subcategoryId && !(await productRepo.categoryExists(input.subcategoryId))) {
    throw new BadRequestError("Selected subcategory does not exist");
  }

  // Slug change → uniqueness
  let slug = existing.slug;
  if (input.slug && slugify(input.slug) !== existing.slug) {
    slug = slugify(input.slug);
    if (await productRepo.slugExists(slug, id)) {
      throw new BadRequestError(`Slug "${slug}" is already taken`);
    }
  }

  // Pricing recompute (jo diya wahi, warna existing repo se laana padega —
  // dono na diye to discount touch nahi karte)
  let discountPercent: number | undefined;
  if (input.regularPrice !== undefined || input.salePrice !== undefined) {
    const full = await productRepo.findByIdFull(id);
    const reg = input.regularPrice ?? full!.regularPrice;
    const sale = input.salePrice ?? full!.salePrice;
    if (sale > reg && reg > 0) {
      throw new BadRequestError("Sale price cannot exceed regular price");
    }
    discountPercent = computeDiscount(sale, reg);
  }

  // publishedAt — DRAFT se pehli baar public hone pe set, dobara reset nahi
  const goingPublic = !existing.publishedAt && input.status && input.status !== "DRAFT";

  const data: Prisma.ProductUpdateInput = {
    slug,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.brand !== undefined && { brand: input.brand }),
    ...(input.shortDescription !== undefined && {
      shortDescription: input.shortDescription,
    }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.warranty !== undefined && { warranty: input.warranty }),
    ...(input.videoUrl !== undefined && { videoUrl: input.videoUrl }),
    ...(input.categoryId && { category: { connect: { id: input.categoryId } } }),
    ...(input.subcategoryId !== undefined && {
      subcategory: input.subcategoryId
        ? { connect: { id: input.subcategoryId } }
        : { disconnect: true },
    }),
    ...(input.tags !== undefined && { tags: input.tags }),
    ...(input.colors !== undefined && { colors: input.colors }),
    ...(input.sizes !== undefined && { sizes: input.sizes }),
    ...(input.currency !== undefined && { currency: input.currency }),
    ...(input.regularPrice !== undefined && { regularPrice: input.regularPrice }),
    ...(input.salePrice !== undefined && { salePrice: input.salePrice }),
    ...(discountPercent !== undefined && { discountPercent }),
    ...(input.stock !== undefined && { stock: input.stock }),
    ...(input.cashOnDelivery !== undefined && {
      cashOnDelivery: input.cashOnDelivery,
    }),
    ...(input.specifications !== undefined && {
      specifications: input.specifications as unknown as Prisma.InputJsonValue,
    }),
    ...(input.bannerUrl !== undefined && { bannerUrl: input.bannerUrl }),
    ...(input.status !== undefined && { status: input.status }),
    ...(goingPublic && { publishedAt: new Date() }),
    ...(input.metaTitle !== undefined && { metaTitle: input.metaTitle }),
    ...(input.metaDescription !== undefined && {
      metaDescription: input.metaDescription,
    }),
  };

  // Scalar/relation update pehle
  await productRepo.update(id, data);

  // Arrays diye gaye → replace (cleanup ke liye purani image keys collect karne
  // ki zaroorat nahi yahan — wo orphan ho jaayengi, periodic sweep job clean karega;
  // immediate cleanup deleteProduct me hota hai)
  if (input.images !== undefined) {
    await productRepo.replaceImages(
      id,
      input.images.map(toImageCreate) as Prisma.ProductImageCreateManyProductInput[],
    );
  }
  if (input.variants !== undefined) {
    await productRepo.replaceVariants(id, input.variants.map(toVariantParts));
  }
  if (input.discountCodeIds !== undefined) {
    const vendorId = existing.vendorId;
    const owned = await productRepo.filterOwnedDiscountIds(vendorId, input.discountCodeIds);
    await productRepo.setDiscountCodes(id, owned);
  }

  return productRepo.findByIdFull(id);
}

// ============================================================================
// ARCHIVE - soft delete (status=ARCHIVED + deletedAt). Restore reversible.
// ============================================================================
export async function archiveProduct(id: string, user: AuthUser) {
  const existing = await ensureOwnership(id, user);
  if (existing.status === "ARCHIVED") {
    throw new BadRequestError("Product is already archived");
  }
  return productRepo.update(id, { status: "ARCHIVED", deletedAt: new Date() });
}

// ============================================================================
// RESTORE - ARCHIVED → DRAFT (owner re-publish kare explicitly)
// ============================================================================
export async function restoreProduct(id: string, user: AuthUser) {
  const existing = await ensureOwnership(id, user);
  if (existing.status !== "ARCHIVED") {
    throw new BadRequestError("Product is not archived");
  }
  return productRepo.update(id, { status: "DRAFT", deletedAt: null });
}

// ============================================================================
// DELETE - hard delete + R2/S3 media cleanup (owner/admin)
// ============================================================================
// Order: keys collect (row chahiye) → DB delete → best-effort storage cleanup.
// DB source of truth — storage partial fail pe bhi API success (orphan objects
// ops sweep ka kaam, row zinda rakhne se behtar).
// ============================================================================
export async function deleteProduct(id: string, user: AuthUser) {
  const existing = await ensureOwnership(id, user);
  const keys = extractProductKeys(existing);

  await productRepo.remove(id);

  if (keys.length > 0) {
    try {
      await deleteObjects(keys);
      logger.info({ productId: id, count: keys.length }, "[products] media cleanup done");
    } catch (err) {
      logger.warn({ err, productId: id }, "[products] media cleanup failed (continuing)");
    }
  }
}

// ============================================================================
// extractProductKeys - product ke saare storage object keys (cleanup)
// ============================================================================
// Sources:
//   1. Gallery image keys (ProductImage.key) — authoritative
//   2. Variant image keys
//   3. bannerUrl (URL → key)
//   4. description HTML me embedded media (<img src>, data-r2-key)
// ============================================================================
function extractProductKeys(p: {
  bannerUrl: string | null;
  videoUrl: string | null;
  description: string | null;
  images: { key: string | null; url: string }[];
  variants: { images: { key: string | null; url: string }[] }[];
}): string[] {
  const keys = new Set<string>();

  // (1) gallery — key direct, warna url se derive
  for (const img of p.images) {
    if (img.key) keys.add(img.key);
    else {
      const k = keyFromPublicUrl(img.url);
      if (k) keys.add(k);
    }
  }

  // (2) variant images
  for (const v of p.variants) {
    for (const img of v.images) {
      if (img.key) keys.add(img.key);
      else {
        const k = keyFromPublicUrl(img.url);
        if (k) keys.add(k);
      }
    }
  }

  // (3) banner + video (agar hamare storage me hain)
  for (const url of [p.bannerUrl, p.videoUrl]) {
    if (!url) continue;
    const k = keyFromPublicUrl(url);
    if (k) keys.add(k);
  }

  // (4) TipTap description HTML — embedded media scrape
  if (p.description) {
    // data-r2-key="..." (frontend insert pe stamp karta hai)
    for (const m of p.description.matchAll(/data-r2-key=["']([^"']+)["']/g)) {
      if (m[1]) {
        const k = keyFromPublicUrl(m[1]) ?? m[1];
        if (k) keys.add(k);
      }
    }
    // src/href URLs — legacy fallback
    for (const m of p.description.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/gi)) {
      const k = keyFromPublicUrl(m[1] as string);
      if (k) keys.add(k);
    }
  }

  return [...keys];
}
