// ============================================================================
// products-api.ts — Product / Category / Discount API calls (seller jar)
// ============================================================================
// sellerHttp use karte hain (seller cookie jar + CSRF). Public reads bhi seller
// portal me sellerHttp se chal jaate hain (GET, koi auth issue nahi).
// ============================================================================

import { sellerHttp } from "@/lib/seller-auth/api";
import type {
  ProductListResponse,
  ProductDetail,
  ListProductsQuery,
  CategoryNode,
  DiscountCode,
  DiscountListResponse,
} from "../types";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "../validators/product-validator";

// ─── querystring builder (undefined skip, arrays repeat) ───
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((item) => sp.append(k, String(item)));
    else sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ============================================================================
// PRODUCTS
// ============================================================================
export function fetchSellerProducts(query: ListProductsQuery) {
  return sellerHttp.get<ProductListResponse>(
    `/products/seller/mine${qs(query as Record<string, unknown>)}`,
  );
}

export function fetchPublicProducts(query: ListProductsQuery) {
  return sellerHttp.get<ProductListResponse>(
    `/products${qs(query as Record<string, unknown>)}`,
  );
}

export async function fetchSellerProduct(id: string) {
  const res = await sellerHttp.get<{ product: ProductDetail }>(
    `/products/seller/${id}`,
  );
  return res.product;
}

export async function createProduct(input: CreateProductInput) {
  const res = await sellerHttp.post<{ product: ProductDetail }>(
    "/products",
    input,
  );
  return res.product;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const res = await sellerHttp.patch<{ product: ProductDetail }>(
    `/products/${id}`,
    input,
  );
  return res.product;
}

export function archiveProduct(id: string) {
  return sellerHttp.post<{ product: ProductDetail }>(`/products/${id}/archive`);
}

export function restoreProduct(id: string) {
  return sellerHttp.post<{ product: ProductDetail }>(`/products/${id}/restore`);
}

export function deleteProduct(id: string) {
  return sellerHttp.del<{ deleted: boolean }>(`/products/${id}`);
}

// ============================================================================
// CATEGORIES (public read)
// ============================================================================
export async function fetchCategoryTree() {
  const res = await sellerHttp.get<{ categories: CategoryNode[] }>(
    "/categories?shape=tree",
  );
  return res.categories;
}

// create category / subcategory (parentId set → subcategory). Seller jar.
export async function createCategory(input: {
  name: string;
  parentId?: string | null;
  description?: string;
}) {
  const res = await sellerHttp.post<{ category: CategoryNode }>(
    "/categories",
    input,
  );
  return res.category;
}

// ============================================================================
// DISCOUNTS (seller-scoped)
// ============================================================================
export function fetchDiscounts(query: {
  search?: string;
  isActive?: boolean;
  page?: number;
  cursor?: string | null;
  limit?: number;
}) {
  return sellerHttp.get<DiscountListResponse>(
    `/discounts${qs(query as Record<string, unknown>)}`,
  );
}

export async function createDiscount(
  input: Partial<DiscountCode> & { code: string; value: number },
) {
  const res = await sellerHttp.post<{ discount: DiscountCode }>(
    "/discounts",
    input,
  );
  return res.discount;
}

export async function updateDiscount(id: string, input: Partial<DiscountCode>) {
  const res = await sellerHttp.patch<{ discount: DiscountCode }>(
    `/discounts/${id}`,
    input,
  );
  return res.discount;
}

export function deleteDiscount(id: string) {
  return sellerHttp.del<{ deleted: boolean }>(`/discounts/${id}`);
}
