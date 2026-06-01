// ============================================================================
// product-validator.ts — Zod schemas for product create/edit forms
// ============================================================================
// Backend services/src/modules/product/product.validator.ts ka mirror.
// Frontend submit se pehle validate karta hai (instant field errors), server
// final source of truth hai (defense in depth).
//
// IMPORTANT — pricing: form me RUPEES hold karte hain (UX), submit pe minor
// units (paise) me convert hota hai (× 100) mapper me. Schema rupees validate
// karta hai (>= 0).
// ============================================================================

import { z } from "zod";
import { CATALOG } from "@/config/constants";

// ─── Sub-schemas ───
const imageSchema = z.object({
  url: z.string().url(),
  key: z.string().max(500).nullish(),
  alt: z.string().max(200).nullish(),
  isPrimary: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  sizeBytes: z.number().int().positive().nullish(),
});

const specificationSchema = z.object({
  label: z.string().min(1, "Label required").max(80),
  value: z.string().min(1, "Value required").max(500),
});

const variantSchema = z.object({
  title: z.string().min(1, "Variant title required").max(120),
  color: z.string().max(40).nullish(),
  tags: z.array(z.string().max(40)).max(CATALOG.MAX_TAGS).default([]),
  sku: z.string().max(80).nullish(),
  // Variant price form me rupees (optional override)
  price: z.number().min(0).nullish(),
  stock: z.number().int().min(0).default(0),
  position: z.number().int().min(0).default(0),
  images: z.array(imageSchema).max(CATALOG.MAX_IMAGES_PER_PRODUCT).default([]),
});

const hexColor = z
  .string()
  .regex(/^#?[0-9a-fA-F]{3,8}$/, "Invalid color")
  .max(9);

// ============================================================================
// CREATE schema
// ============================================================================
export const createProductSchema = z
  .object({
    title: z.string().min(2, "Title is too short").max(200),
    slug: z.string().max(120).optional().or(z.literal("")),
    brand: z.string().max(120).optional().or(z.literal("")),

    shortDescription: z.string().max(2000).optional().or(z.literal("")),
    description: z.string().max(200_000).optional().or(z.literal("")),

    warranty: z.string().max(120).optional().or(z.literal("")),
    videoUrl: z.string().url("Invalid URL").optional().or(z.literal("")),

    categoryId: z.string().min(1, "Select a category"),
    subcategoryId: z.string().optional().or(z.literal("")),

    tags: z.array(z.string().max(40)).max(CATALOG.MAX_TAGS).default([]),
    colors: z.array(hexColor).max(CATALOG.MAX_COLORS).default([]),
    sizes: z.array(z.string().max(10)).max(20).default([]),

    currency: z.string().length(3).default("INR"),
    // Rupees in form (>= 0)
    regularPrice: z.number().min(0).default(0),
    salePrice: z.number().min(0).default(0),

    stock: z.number().int().min(0).default(0),
    cashOnDelivery: z.boolean().default(true),

    specifications: z.array(specificationSchema).max(50).default([]),

    bannerUrl: z.string().url().optional().or(z.literal("")),
    images: z
      .array(imageSchema)
      .max(CATALOG.MAX_IMAGES_PER_PRODUCT)
      .default([]),
    variants: z
      .array(variantSchema)
      .max(CATALOG.MAX_VARIANTS_PER_PRODUCT)
      .default([]),

    discountCodeIds: z.array(z.string()).max(20).default([]),

    status: z.enum(["DRAFT", "PENDING", "ACTIVE"]).default("DRAFT"),

    // Event sale window — datetime-local strings ("" = not set). nullish taaki
    // mapper null bhej sake (clear) aur payload type match kare.
    eventStartsAt: z.string().nullish(),
    eventEndsAt: z.string().nullish(),

    metaTitle: z.string().max(160).optional().or(z.literal("")),
    metaDescription: z.string().max(320).optional().or(z.literal("")),
  })
  .refine((d) => d.regularPrice === 0 || d.salePrice <= d.regularPrice, {
    message: "Sale price cannot exceed regular price",
    path: ["salePrice"],
  })
  // ACTIVE publish ke liye kam se kam ek image
  .refine((d) => d.status !== "ACTIVE" || d.images.length > 0, {
    message: "Add at least one image to publish",
    path: ["images"],
  });

// Input (RHF holds — defaults optional) vs Output (resolver returns — filled)
export type CreateProductFormInput = z.input<typeof createProductSchema>;
export type CreateProductInput = z.output<typeof createProductSchema>;

// ============================================================================
// Status options for the create form's Status <Select> (course pattern)
// ============================================================================
// Create/edit pe 3 valid status:
//   DRAFT   → draft me bachao (private)
//   PENDING → admin approval ke liye bhejo (multi-vendor marketplace flow)
//   ACTIVE  → publish (UI label "Published", buyer-facing term)
// ARCHIVED/DELETED yahan nahi — wo dedicated archive/delete actions se aate hain.
export const productStatuses = ["DRAFT", "PENDING", "ACTIVE"] as const;
export const productStatusLabels: Record<
  (typeof productStatuses)[number],
  string
> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  ACTIVE: "Published",
};

// ============================================================================
// UPDATE schema — all optional (PATCH semantics). status me OUT_OF_STOCK bhi.
// ============================================================================
export const updateProductFields = z.object({
  title: z.string().min(2).max(200).optional(),
  slug: z.string().max(120).optional(),
  brand: z.string().max(120).nullish(),
  shortDescription: z.string().max(2000).nullish(),
  description: z.string().max(200_000).nullish(),
  warranty: z.string().max(120).nullish(),
  videoUrl: z.string().url().nullish().or(z.literal("")),
  categoryId: z.string().optional(),
  subcategoryId: z.string().nullish(),
  tags: z.array(z.string().max(40)).max(CATALOG.MAX_TAGS).optional(),
  colors: z.array(hexColor).max(CATALOG.MAX_COLORS).optional(),
  sizes: z.array(z.string().max(10)).max(20).optional(),
  currency: z.string().length(3).optional(),
  regularPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  cashOnDelivery: z.boolean().optional(),
  specifications: z.array(specificationSchema).max(50).optional(),
  bannerUrl: z.string().url().nullish().or(z.literal("")),
  images: z.array(imageSchema).max(CATALOG.MAX_IMAGES_PER_PRODUCT).optional(),
  variants: z
    .array(variantSchema)
    .max(CATALOG.MAX_VARIANTS_PER_PRODUCT)
    .optional(),
  discountCodeIds: z.array(z.string()).max(20).optional(),
  status: z.enum(["DRAFT", "PENDING", "ACTIVE", "OUT_OF_STOCK"]).optional(),
  eventStartsAt: z.string().nullish(),
  eventEndsAt: z.string().nullish(),
  metaTitle: z.string().max(160).nullish(),
  metaDescription: z.string().max(320).nullish(),
});

export type UpdateProductInput = z.infer<typeof updateProductFields>;

// ============================================================================
// slugify — title → slug (backend utils/slugify.ts behaviour match)
// ============================================================================
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // diacritics strip
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
