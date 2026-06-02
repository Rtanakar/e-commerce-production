// ============================================================================
// shop-api.ts — Customer cart / wishlist / products API (customer cookie jar)
// ============================================================================
// `api` (lib/api.ts) = customer client (at/rt/csrf cookies + auto CSRF). Public
// product reads bhi yahin se (GET, koi auth nahi).
// ============================================================================

import { api } from "@/lib/api";
import type {
  CartResponse,
  WishlistResponse,
  ShopProduct,
} from "../types";

// ─── querystring builder ───
function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) v.forEach((i) => sp.append(k, String(i)));
    else sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ============================================================================
// PRODUCTS (public)
// ============================================================================
export interface ShopProductsQuery {
  search?: string;
  categoryId?: string;
  tag?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: "newest" | "oldest" | "price-asc" | "price-desc" | "popular" | "rating" | "discount";
  page?: number;
  limit?: number;
  cursor?: string | null;
}

interface PublicListResponse {
  products: ShopProduct[];
  nextCursor: string | null;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  limit: number;
}

export function fetchShopProducts(query: ShopProductsQuery) {
  return api.get<PublicListResponse>(`/products${qs(query as Record<string, unknown>)}`);
}

export async function fetchShopProduct(slug: string) {
  const res = await api.get<{ product: ShopProduct }>(`/products/${slug}`);
  return res.product;
}

// ============================================================================
// CART (logged-in customer)
// ============================================================================
type ItemRef = { productId: string; variantId?: string | null };

export const cartApi = {
  get: () => api.get<CartResponse>("/cart"),
  count: () => api.get<{ count: number }>("/cart/count"),
  add: (body: ItemRef & { quantity?: number }) => api.post<CartResponse>("/cart/items", body),
  setQty: (body: ItemRef & { quantity: number }) => api.patch<CartResponse>("/cart/items", body),
  remove: (body: ItemRef) => api.delete<CartResponse>("/cart/items", { body }),
  clear: () => api.delete<CartResponse>("/cart"),
  merge: (items: Array<ItemRef & { quantity: number }>) =>
    api.post<CartResponse>("/cart/merge", { items }),
};

// ============================================================================
// WISHLIST (logged-in customer)
// ============================================================================
export const wishlistApi = {
  get: () => api.get<WishlistResponse>("/wishlist"),
  count: () => api.get<{ count: number }>("/wishlist/count"),
  ids: () => api.get<{ items: { productId: string; variantId: string | null }[] }>("/wishlist/ids"),
  toggle: (body: ItemRef) =>
    api.post<WishlistResponse & { wishlisted: boolean }>("/wishlist/toggle", body),
  add: (body: ItemRef) => api.post<WishlistResponse>("/wishlist/items", body),
  remove: (body: ItemRef) => api.delete<WishlistResponse>("/wishlist/items", { body }),
  merge: (items: ItemRef[]) => api.post<WishlistResponse>("/wishlist/merge", { items }),
};
