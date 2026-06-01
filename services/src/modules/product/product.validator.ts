// ============================================================================
// product.validator.ts - Zod schemas for product CRUD
// ============================================================================
// Pricing minor units (Int) me — frontend "20$" ko 2000 (cents) me convert
// karke bhejega. description = TipTap HTML string (JSON nahi).
// Images presign flow se pehle upload hoti hain, yahan sirf {url,key,...} aata.
// ============================================================================

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { PAGINATION, CATALOG } from "../../config/constants.js";

extendZodWithOpenApi(z);

// ============================================================================
// Sub-schemas
// ============================================================================

// Ek gallery/variant image — presign ke baad client yeh metadata bhejta hai
const imageSchema = z.object({
  url: z.string().url(),
  key: z.string().max(500).optional(), // storage key (delete cleanup ke liye)
  alt: z.string().max(200).optional(),
  isPrimary: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sizeBytes: z.number().int().positive().optional(),
});

// Custom specification / property — "Add Specification" rows
const specificationSchema = z.object({
  label: z.string().min(1).max(80).trim(),
  value: z.string().min(1).max(500).trim(),
});

// Variant — "Edit your variant" modal
const variantSchema = z.object({
  title: z.string().min(1).max(120).trim(),
  color: z.string().max(40).optional(),
  tags: z.array(z.string().max(40)).max(CATALOG.MAX_TAGS).default([]),
  sku: z.string().max(80).optional(),
  price: z.number().int().min(0).optional(), // minor units, optional override
  stock: z.number().int().min(0).default(0),
  position: z.number().int().min(0).default(0),
  images: z.array(imageSchema).max(CATALOG.MAX_IMAGES_PER_PRODUCT).default([]),
});

// hex color string ("#ffffff")
const hexColor = z
  .string()
  .regex(/^#?[0-9a-fA-F]{3,8}$/, "Invalid color")
  .max(9);

// ============================================================================
// CREATE PRODUCT
// ============================================================================
export const createProductSchema = z
  .object({
    // ── Identity ──
    title: z.string().min(2).max(CATALOG.MAX_TITLE_LENGTH).trim(),
    slug: z.string().min(2).max(120).trim().optional(), // na do → auto
    brand: z.string().max(120).trim().optional(),

    // ── Descriptions ──
    shortDescription: z.string().max(2000).trim().optional(), // ~150 words
    description: z.string().max(200_000).optional(), // TipTap HTML string

    warranty: z.string().max(120).trim().optional(),
    videoUrl: z.string().url().max(500).optional(),

    // ── Taxonomy ──
    categoryId: z.string().cuid(),
    subcategoryId: z.string().cuid().optional().nullable(),

    // ── Attribute arrays ──
    tags: z.array(z.string().max(40).trim()).max(CATALOG.MAX_TAGS).default([]),
    colors: z.array(hexColor).max(CATALOG.MAX_COLORS).default([]),
    sizes: z.array(z.string().max(10)).max(20).default([]),

    // ── Pricing (minor units) ──
    currency: z.string().length(3).default("INR"),
    regularPrice: z.number().int().min(0),
    salePrice: z.number().int().min(0),

    // ── Inventory ──
    stock: z.number().int().min(0).default(0),
    cashOnDelivery: z.boolean().default(true),

    // ── Custom specs ──
    specifications: z.array(specificationSchema).max(50).default([]),

    // ── Media ──
    bannerUrl: z.string().url().max(500).optional(),
    images: z.array(imageSchema).max(CATALOG.MAX_IMAGES_PER_PRODUCT).default([]),
    variants: z.array(variantSchema).max(CATALOG.MAX_VARIANTS_PER_PRODUCT).default([]),

    // ── Discounts (seller ke apne code ids) ──
    discountCodeIds: z.array(z.string().cuid()).max(20).default([]),

    // ── Lifecycle ──
    // "Save Draft" → DRAFT, "Create" → ACTIVE
    status: z.enum(["DRAFT", "PENDING", "ACTIVE"]).default("DRAFT"),

    // ── Event / limited-time sale (optional deal window) ──
    eventStartsAt: z.coerce.date().optional().nullable(),
    eventEndsAt: z.coerce.date().optional().nullable(),

    // ── SEO ──
    metaTitle: z.string().max(160).trim().optional(),
    metaDescription: z.string().max(320).trim().optional(),
  })
  // salePrice MRP se zyada na ho
  .refine((d) => d.salePrice <= d.regularPrice || d.regularPrice === 0, {
    message: "Sale price cannot exceed regular price",
    path: ["salePrice"],
  })
  // event end start ke baad ho
  .refine(
    (d) => !d.eventStartsAt || !d.eventEndsAt || d.eventEndsAt > d.eventStartsAt,
    { message: "Event end must be after event start", path: ["eventEndsAt"] },
  )
  // ACTIVE publish ke liye kam se kam ek image zaroori
  .refine((d) => d.status !== "ACTIVE" || d.images.length > 0, {
    message: "At least one image is required to publish a product",
    path: ["images"],
  })
  .openapi("CreateProductRequest");

// ============================================================================
// UPDATE PRODUCT - sab optional (PATCH). Arrays diye to REPLACE hote hain.
// ============================================================================
export const updateProductSchema = z
  .object({
    title: z.string().min(2).max(CATALOG.MAX_TITLE_LENGTH).trim().optional(),
    slug: z.string().min(2).max(120).trim().optional(),
    brand: z.string().max(120).trim().optional().nullable(),
    shortDescription: z.string().max(2000).trim().optional().nullable(),
    description: z.string().max(200_000).optional().nullable(),
    warranty: z.string().max(120).trim().optional().nullable(),
    videoUrl: z.string().url().max(500).optional().nullable(),
    categoryId: z.string().cuid().optional(),
    subcategoryId: z.string().cuid().optional().nullable(),
    tags: z.array(z.string().max(40).trim()).max(CATALOG.MAX_TAGS).optional(),
    colors: z.array(hexColor).max(CATALOG.MAX_COLORS).optional(),
    sizes: z.array(z.string().max(10)).max(20).optional(),
    currency: z.string().length(3).optional(),
    regularPrice: z.number().int().min(0).optional(),
    salePrice: z.number().int().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    cashOnDelivery: z.boolean().optional(),
    specifications: z.array(specificationSchema).max(50).optional(),
    bannerUrl: z.string().url().max(500).optional().nullable(),
    // Arrays diye → poori list replace; na diye → unchanged
    images: z.array(imageSchema).max(CATALOG.MAX_IMAGES_PER_PRODUCT).optional(),
    variants: z.array(variantSchema).max(CATALOG.MAX_VARIANTS_PER_PRODUCT).optional(),
    discountCodeIds: z.array(z.string().cuid()).max(20).optional(),
    status: z.enum(["DRAFT", "PENDING", "ACTIVE", "OUT_OF_STOCK"]).optional(),
    eventStartsAt: z.coerce.date().optional().nullable(),
    eventEndsAt: z.coerce.date().optional().nullable(),
    metaTitle: z.string().max(160).trim().optional().nullable(),
    metaDescription: z.string().max(320).trim().optional().nullable(),
  })
  .openapi("UpdateProductRequest");

// ============================================================================
// LIST query - public + seller, cursor + offset hybrid
// ============================================================================
export const listProductsSchema = z.object({
  search: z.string().trim().optional(),
  // seller "All Products" multiple status filter; public route force ACTIVE
  status: z
    .union([
      z.enum(["DRAFT", "PENDING", "ACTIVE", "ARCHIVED", "DELETED", "OUT_OF_STOCK"]),
      z.array(z.enum(["DRAFT", "PENDING", "ACTIVE", "ARCHIVED", "DELETED", "OUT_OF_STOCK"])),
    ])
    .optional(),
  categoryId: z.string().cuid().optional(),
  subcategoryId: z.string().cuid().optional(),
  tag: z.string().max(40).optional(),
  brand: z.string().max(120).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z
    .enum(["newest", "oldest", "price-asc", "price-desc", "popular", "rating", "discount"])
    .default("newest"),
  cursor: z.string().cuid().optional().nullable(),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION.MIN_PAGE_SIZE)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
});

// params
export const productIdParam = z.object({ id: z.string().cuid() });
export const productSlugParam = z.object({ slug: z.string().min(1) });

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsSchema>;
export type ProductImageInput = z.infer<typeof imageSchema>;
export type ProductVariantInput = z.infer<typeof variantSchema>;
