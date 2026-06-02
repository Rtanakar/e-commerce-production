// ============================================================================
// use-cart.ts — Unified cart (guest Zustand ↔ server TanStack Query)
// ============================================================================
// Ek hook jo dono modes handle karta:
//   - Logged OUT → guest store (localStorage), optimistic, no network
//   - Logged IN  → server cart (TanStack Query), mutations server pe
//   - Login transition → guest items server me MERGE, fir guest store clear
//
// Components sirf `useCart()` use karte; auth detail abstract. Amazon jaisa
// seamless guest→user cart handoff.
// ============================================================================

"use client";

import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/lib/auth/hooks";
import { ApiError } from "@/lib/api";
import { cartApi } from "../api/shop-api";
import { useCartStore } from "../store/use-cart-store";
import type { CartResponse, GuestCartItem } from "../types";

export const cartKeys = {
  all: ["cart"] as const,
  detail: () => [...cartKeys.all, "detail"] as const,
};

// ── Module-level merge guard (saare useCart instances me SHARED) ──
// useCart har add-to-cart-button me mount hota (grid pe N instances). Agar guard
// per-instance (useRef) ho to login pe N concurrent merge fire → cart qty N× ho
// jaati. Module-level flag se login pe SIRF EK merge chalega. Logout pe reset
// (isAuthed false) taaki agla login phir merge kare. Amazon-grade single-sync.
let cartMerged = false;

interface AddArgs {
  productId: string;
  variantId?: string | null;
  quantity?: number;
  // guest snapshot (offline render)
  snapshot: Omit<GuestCartItem, "quantity" | "productId" | "variantId">;
}

export function useCart() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAuthed = !!me;

  const guest = useCartStore();

  // ── Server cart (sirf logged-in) ──
  const serverQuery = useQuery<CartResponse, ApiError>({
    queryKey: cartKeys.detail(),
    queryFn: cartApi.get,
    enabled: isAuthed,
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });

  // ── Login pe guest cart server me merge (login session me sirf ek baar) ──
  useEffect(() => {
    // Logout → guard reset, taaki agle login pe naye guest items phir merge ho
    if (!isAuthed) {
      cartMerged = false;
      return;
    }
    if (cartMerged) return;
    cartMerged = true; // sync claim — concurrent instances (same tick) skip karein

    const items = useCartStore.getState().items;
    if (items.length === 0) return; // kuch merge karne ko nahi, par claimed rahega

    cartApi
      .merge(
        items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      )
      .then((cart) => {
        qc.setQueryData(cartKeys.detail(), cart);
        useCartStore.getState().clear(); // guest cart server me chala gaya
      })
      .catch(() => {
        cartMerged = false; // merge fail → guest items rehne do, dobara try ho sake
      });
  }, [isAuthed, qc]);

  // ── Mutations (server) ──
  const addMut = useMutation({
    mutationFn: cartApi.add,
    onSuccess: (cart) => qc.setQueryData(cartKeys.detail(), cart),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed to add"),
  });
  const setQtyMut = useMutation({
    mutationFn: cartApi.setQty,
    onSuccess: (cart) => qc.setQueryData(cartKeys.detail(), cart),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed to update"),
  });
  const removeMut = useMutation({
    mutationFn: cartApi.remove,
    onSuccess: (cart) => qc.setQueryData(cartKeys.detail(), cart),
  });
  const clearMut = useMutation({
    mutationFn: cartApi.clear,
    onSuccess: (cart) => qc.setQueryData(cartKeys.detail(), cart),
  });

  // ============================================================================
  // Unified API (component inhe call karte — auth-agnostic)
  // ============================================================================
  const add = ({ productId, variantId = null, quantity = 1, snapshot }: AddArgs) => {
    if (isAuthed) {
      addMut.mutate({ productId, variantId, quantity });
    } else {
      guest.addItem({ productId, variantId, ...snapshot }, quantity);
    }
    toast.success(`Added ${snapshot.name}`);
  };

  const setQty = (productId: string, variantId: string | null, qty: number) => {
    if (isAuthed) setQtyMut.mutate({ productId, variantId, quantity: qty });
    else guest.setQty(productId, variantId, qty);
  };

  const remove = (productId: string, variantId: string | null) => {
    if (isAuthed) removeMut.mutate({ productId, variantId });
    else guest.removeItem(productId, variantId);
  };

  const clear = () => {
    if (isAuthed) clearMut.mutate();
    else guest.clear();
  };

  // qty lookup (stepper) — server line ya guest
  const getQty = (productId: string, variantId: string | null = null): number => {
    if (isAuthed) {
      const line = serverQuery.data?.items.find(
        (i) => i.productId === productId && (i.variantId ?? null) === variantId,
      );
      return line?.quantity ?? 0;
    }
    return guest.getQty(productId, variantId);
  };

  // derived totals
  const totalItems = isAuthed
    ? (serverQuery.data?.summary.totalItems ?? 0)
    : guest.totalItems();

  return {
    isAuthed,
    items: isAuthed ? (serverQuery.data?.items ?? []) : guest.items,
    summary: serverQuery.data?.summary ?? null,
    totalItems,
    isLoading: isAuthed && serverQuery.isLoading,
    isMutating: addMut.isPending || setQtyMut.isPending || removeMut.isPending,
    add,
    setQty,
    remove,
    clear,
    getQty,
  };
}
