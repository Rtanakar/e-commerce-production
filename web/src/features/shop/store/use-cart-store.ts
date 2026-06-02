// ============================================================================
// use-cart-store.ts — Guest cart (Zustand + localStorage persist)
// ============================================================================
// Strategy (Amazon/Flipkart guest-cart pattern):
//   - Logged-out user: cart yahin (localStorage) rehta — instant, no network
//   - Login pe: yeh items server me MERGE ho jaate (use-cart hook), fir store
//     clear ho jaata aur server cart (TanStack Query) source-of-truth banta
//   - Optimistic UI: badge/stepper turant update, server call background me
//
// Yeh store SIRF guest state + UI optimism ke liye. Logged-in ka actual data
// `useCart` (TanStack Query) se aata hai. Components dono ko combine karte.
// ============================================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GuestCartItem } from "../types";

// line ka unique key (product + variant) — variant null bhi distinct
function lineKey(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? "_"}`;
}

interface CartStore {
  items: GuestCartItem[];

  // derived helpers
  totalItems: () => number;
  getQty: (productId: string, variantId?: string | null) => number;

  // mutations (guest)
  addItem: (item: Omit<GuestCartItem, "quantity">, qty?: number) => void;
  setQty: (productId: string, variantId: string | null, qty: number) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  clear: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      getQty: (productId, variantId = null) => {
        const key = lineKey(productId, variantId);
        return (
          get().items.find((i) => lineKey(i.productId, i.variantId) === key)
            ?.quantity ?? 0
        );
      },

      addItem: (item, qty = 1) =>
        set((state) => {
          const key = lineKey(item.productId, item.variantId);
          const existing = state.items.find(
            (i) => lineKey(i.productId, i.variantId) === key,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                lineKey(i.productId, i.variantId) === key
                  ? { ...i, quantity: i.quantity + qty }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: qty }] };
        }),

      setQty: (productId, variantId, qty) =>
        set((state) => {
          const key = lineKey(productId, variantId);
          if (qty <= 0) {
            return {
              items: state.items.filter(
                (i) => lineKey(i.productId, i.variantId) !== key,
              ),
            };
          }
          return {
            items: state.items.map((i) =>
              lineKey(i.productId, i.variantId) === key
                ? { ...i, quantity: qty }
                : i,
            ),
          };
        }),

      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (i) =>
              lineKey(i.productId, i.variantId) !==
              lineKey(productId, variantId),
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "guest_cart",
      // sirf items persist (functions nahi)
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
