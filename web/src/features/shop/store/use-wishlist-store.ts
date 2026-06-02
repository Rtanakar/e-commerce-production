// ============================================================================
// use-wishlist-store.ts — Guest wishlist (Zustand + localStorage persist)
// ============================================================================
// Cart store ka chhota bhai (no quantity). Logged-out user ke liye; login pe
// server me merge (use-wishlist hook). product+variant pe unique.
// ============================================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GuestWishlistItem } from "../types";

function lineKey(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? "_"}`;
}

interface WishlistStore {
  items: GuestWishlistItem[];
  count: () => number;
  has: (productId: string, variantId?: string | null) => boolean;
  toggle: (item: GuestWishlistItem) => boolean; // returns new state (true = added)
  add: (item: GuestWishlistItem) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],

      count: () => get().items.length,

      has: (productId, variantId = null) => {
        const key = lineKey(productId, variantId);
        return get().items.some(
          (i) => lineKey(i.productId, i.variantId) === key,
        );
      },

      toggle: (item) => {
        const key = lineKey(item.productId, item.variantId);
        const exists = get().items.some(
          (i) => lineKey(i.productId, i.variantId) === key,
        );
        if (exists) {
          set((s) => ({
            items: s.items.filter(
              (i) => lineKey(i.productId, i.variantId) !== key,
            ),
          }));
          return false;
        }
        set((s) => ({ items: [...s.items, item] }));
        return true;
      },

      add: (item) =>
        set((s) => {
          const key = lineKey(item.productId, item.variantId);
          if (s.items.some((i) => lineKey(i.productId, i.variantId) === key))
            return s;
          return { items: [...s.items, item] };
        }),

      remove: (productId, variantId) =>
        set((s) => ({
          items: s.items.filter(
            (i) =>
              lineKey(i.productId, i.variantId) !==
              lineKey(productId, variantId),
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "guest_wishlist",
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
