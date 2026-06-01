// ============================================================================
// prefetch.ts — server-side seller products prefetch (cookie-forwarded)
// ============================================================================
// Page (server component) isse call karta hai → cache warm → client useProducts
// same queryKey pe instant hit. Seller cookie jar forward karte hain (RSC me
// cookies auto nahi jaati), getServerSeller wala pattern.
// ============================================================================

import { cookies } from "next/headers";
import { getQueryClient } from "@/lib/query-client";
import { productKeys } from "../api/product-keys";
import type { SellerProductsApiQuery } from "./params-loader";
import type { ProductListResponse } from "../types";

const API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080/api/v1";

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function fetchServer(
  query: SellerProductsApiQuery,
  cookie: string,
): Promise<ProductListResponse> {
  const res = await fetch(
    `${API_URL}/products/seller/mine${qs(query as unknown as Record<string, unknown>)}`,
    { headers: { Cookie: cookie, Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  const json = (await res.json()) as { data: ProductListResponse };
  return json.data;
}

export async function prefetchSellerProducts(query: SellerProductsApiQuery) {
  const queryClient = getQueryClient();
  const store = await cookies();
  const cookie = store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

  // queryKey client useProducts ke productKeys.sellerList(apiQuery) se EXACT match
  await queryClient.prefetchQuery({
    queryKey: productKeys.sellerList(query),
    queryFn: () => fetchServer(query, cookie),
  });
}
