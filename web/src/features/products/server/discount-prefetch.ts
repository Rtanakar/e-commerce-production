// ============================================================================
// discount-prefetch.ts — server-side seller discounts prefetch (cookie-fwd)
// ============================================================================

import { cookies } from "next/headers";
import { getQueryClient } from "@/lib/query-client";
import { discountKeys } from "../api/product-keys";
import type { SellerDiscountsApiQuery } from "./discount-params-loader";
import type { DiscountListResponse } from "../types";

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
  query: SellerDiscountsApiQuery,
  cookie: string,
): Promise<DiscountListResponse> {
  const res = await fetch(
    `${API_URL}/discounts${qs(query as unknown as Record<string, unknown>)}`,
    { headers: { Cookie: cookie, Accept: "application/json" }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to load discounts (${res.status})`);
  const json = (await res.json()) as { data: DiscountListResponse };
  return json.data;
}

export async function prefetchSellerDiscounts(query: SellerDiscountsApiQuery) {
  const queryClient = getQueryClient();
  const store = await cookies();
  const cookie = store.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  await queryClient.prefetchQuery({
    queryKey: discountKeys.list(query),
    queryFn: () => fetchServer(query, cookie),
  });
}
