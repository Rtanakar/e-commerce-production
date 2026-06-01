// ============================================================================
// types.ts — Product domain types (mirrors backend Prisma + API responses)
// ============================================================================
// Pricing minor units me aata hai (paise). Form me rupees dikhate hain →
// mapper functions convert karte hain (× / ÷ 100).
// ============================================================================

export type ProductStatus =
  | "DRAFT"
  | "PENDING"
  | "ACTIVE"
  | "ARCHIVED"
  | "DELETED"
  | "OUT_OF_STOCK";
export type DiscountType = "PERCENT" | "FLAT";

export type ProductSort =
  | "newest"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "popular"
  | "rating"
  | "discount";

// ─── Image (gallery / variant) ───
export interface ProductImage {
  id?: string;
  url: string;
  key?: string | null;
  alt?: string | null;
  isPrimary?: boolean;
  position?: number;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
}

// ─── Variant ("Edit your variant" modal) ───
export interface ProductVariant {
  id?: string;
  title: string;
  color?: string | null;
  tags: string[];
  sku?: string | null;
  price?: number | null; // minor units
  stock: number;
  position?: number;
  images: ProductImage[];
}

// ─── Custom specification row ───
export interface ProductSpecification {
  label: string;
  value: string;
}

// ─── Category (light, from /categories) ───
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  isActive: boolean;
  children?: CategoryNode[];
}

// ─── Discount code (seller-scoped) ───
export interface DiscountCode {
  id: string;
  code: string;
  title?: string | null;
  type: DiscountType;
  value: number; // PERCENT → %, FLAT → minor units
  minOrder?: number | null;
  maxUses?: number | null;
  usedCount: number;
  perUserLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Category ref on a product detail ───
export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

// ─── List card (GET /products | /products/seller/mine) ───
export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  status: ProductStatus;
  currency: string;
  regularPrice: number; // minor units
  salePrice: number; // minor units
  discountPercent: number;
  stock: number;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  createdAt: string;
  deletedAt: string | null; // soft-delete timestamp (DELETED state)
  purgeAt: string | null; // 24h auto-purge deadline — countdown ke liye
  images: { url: string; alt: string | null }[];
}

// ─── Full product detail (GET /products/:slug | /products/seller/:id) ───
export interface ProductDetail extends Omit<ProductListItem, "images"> {
  shortDescription: string | null;
  description: string | null; // TipTap HTML string
  warranty: string | null;
  videoUrl: string | null;
  bannerUrl: string | null;
  categoryId: string;
  subcategoryId: string | null;
  category: CategoryRef | null;
  subcategory: CategoryRef | null;
  tags: string[];
  colors: string[];
  sizes: string[];
  specifications: ProductSpecification[] | null;
  cashOnDelivery: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  publishedAt: string | null;
  viewCount: number;
  updatedAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
  discountCodes: DiscountCode[];
}

// ─── Paginated list response (cursor + offset hybrid) ───
export interface ProductListResponse {
  products: ProductListItem[];
  nextCursor: string | null;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  limit: number;
}

export interface DiscountListResponse {
  discounts: DiscountCode[];
  nextCursor: string | null;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  limit: number;
}

// ─── List query shape ───
export interface ListProductsQuery {
  search?: string;
  status?: string | string[];
  categoryId?: string;
  subcategoryId?: string;
  tag?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort;
  cursor?: string | null;
  page?: number;
  limit?: number;
}

// ─── Status badge meta (theme-aware tones) ───
export const PRODUCT_STATUS_META: Record<
  ProductStatus,
  { label: string; tone: string }
> = {
  DRAFT: {
    label: "Draft",
    tone: "bg-muted text-muted-foreground border-border",
  },
  PENDING: {
    label: "Pending",
    tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  ACTIVE: {
    label: "Published",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  ARCHIVED: {
    label: "Archived",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  DELETED: {
    label: "Deleted",
    tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  },
  OUT_OF_STOCK: {
    label: "Out of stock",
    tone: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
};
