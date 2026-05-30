// ============================================================================
// use-sidebar-store.ts — Zustand store for the seller dashboard sidebar
// ============================================================================
// Drives the desktop expand/collapse state of the seller-portal sidebar. We
// feed this into shadcn's <SidebarProvider open onOpenChange> (controlled
// mode) so the polished, accessible, theme-aware Sidebar component renders
// while OUR store owns the state — single source of truth across header
// trigger, keyboard shortcut, and the rail.
//
// Why Zustand over shadcn's built-in cookie state?
//   • One store importable anywhere (header button, command palette, etc.)
//     without prop-drilling or context gymnastics.
//   • `persist` keeps the user's collapse preference across reloads/sessions.
//   • Trivial to extend later (pinned items, density, mobile drawer, etc.).
//
// Mobile drawer (Sheet) stays inside shadcn's provider — it's ephemeral and
// route-scoped, so it doesn't belong in persisted global state.
// ============================================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  /** Desktop sidebar expanded (true) vs icon-collapsed (false). */
  open: boolean;
  /** True once persisted state has rehydrated from localStorage (SSR-safe). */
  hydrated: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setHydrated: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      open: true,
      hydrated: false,
      setOpen: (open) => set({ open }),
      toggle: () => set((s) => ({ open: !s.open })),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "seller-sidebar", // localStorage key
      // Only persist the user preference, never the hydration flag
      partialize: (s) => ({ open: s.open }),
      // Flip `hydrated` once localStorage has been read on the client. The
      // provider uses this to avoid a flash/mismatch: it renders the default
      // (expanded) on SSR + first paint, then snaps to the persisted value.
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
