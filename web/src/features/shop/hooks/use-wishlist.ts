// ============================================================================
// use-wishlist.ts — Unified wishlist (guest Zustand ↔ server TanStack Query)
// ============================================================================
// use-cart ka pattern, wishlist ke liye (no quantity, toggle-based).
// ============================================================================

"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMe } from "@/lib/auth/hooks";
import { ApiError } from "@/lib/api";
import { wishlistApi } from "../api/shop-api";
import { useWishlistStore } from "../store/use-wishlist-store";
import type { WishlistResponse, GuestWishlistItem } from "../types";

export const wishlistKeys = {
  all: ["wishlist"] as const,
  detail: () => [...wishlistKeys.all, "detail"] as const,
};

// ── Module-level merge guard (saare useWishlist instances me SHARED) ──
// use-cart wala hi pattern: heart-button har card pe mount hota, isliye guard
// module-level — login pe ek hi merge, logout pe reset. [[use-cart]] dekho.
let wishlistMerged = false;

export function useWishlist() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAuthed = !!me;
  const guest = useWishlistStore();

  const serverQuery = useQuery<WishlistResponse, ApiError>({
    queryKey: wishlistKeys.detail(),
    queryFn: wishlistApi.get,
    enabled: isAuthed,
    staleTime: 30 * 1000,
  });

  // ── Login pe guest wishlist merge (login session me sirf ek baar) ──
  useEffect(() => {
    if (!isAuthed) {
      wishlistMerged = false; // logout → agle login pe phir merge
      return;
    }
    if (wishlistMerged) return;
    wishlistMerged = true; // sync claim — concurrent instances skip karein

    const items = useWishlistStore.getState().items;
    if (items.length === 0) return;
    wishlistApi
      .merge(items.map((i) => ({ productId: i.productId, variantId: i.variantId })))
      .then((wl) => {
        qc.setQueryData(wishlistKeys.detail(), wl);
        useWishlistStore.getState().clear();
      })
      .catch(() => {
        wishlistMerged = false; // fail → dobara try ho sake
      });
  }, [isAuthed, qc]);

  const toggleMut = useMutation({
    mutationFn: wishlistApi.toggle,
    onSuccess: (res) => {
      qc.setQueryData(wishlistKeys.detail(), { items: res.items, count: res.count });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Failed"),
  });

  // toggle — heart click. Returns nothing; toast feedback.
  const toggle = (item: GuestWishlistItem) => {
    if (isAuthed) {
      // optimistic-ish: server response se sync
      toggleMut.mutate(
        { productId: item.productId, variantId: item.variantId },
        {
          onSuccess: (res) =>
            toast.success(res.wishlisted ? "Added to wishlist" : "Removed from wishlist"),
        },
      );
    } else {
      const added = guest.toggle(item);
      toast.success(added ? "Added to wishlist" : "Removed from wishlist");
    }
  };

  // is product wishlisted? (heart filled state)
  const has = (productId: string, variantId: string | null = null): boolean => {
    if (isAuthed) {
      return (serverQuery.data?.items ?? []).some(
        (i) => i.productId === productId && (i.variantId ?? null) === variantId,
      );
    }
    return guest.has(productId, variantId);
  };

  const count = isAuthed ? (serverQuery.data?.count ?? 0) : guest.count();

  return {
    isAuthed,
    items: isAuthed ? (serverQuery.data?.items ?? []) : guest.items,
    count,
    isLoading: isAuthed && serverQuery.isLoading,
    toggle,
    has,
  };
}
