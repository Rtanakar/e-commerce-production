// ============================================================================
// nav.ts — Seller dashboard sidebar navigation (single source of truth)
// ============================================================================
// Groups + items mirror the seller-dashboard reference exactly:
//   Main Menu   → Dashboard, Orders, Payments
//   Products    → Create Product, All Products
//   Events      → Create Event, All Events
//   Controllers → Inbox, Settings, Notifications
//   Extras      → Discount Codes  (+ Logout rendered separately as an action)
//
// All routes live under /seller/* (the seller subdomain serves these). Keeping
// the config declarative means the sidebar component stays dumb — it just maps.
// ============================================================================

import {
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  SquarePlus,
  Boxes,
  CalendarPlus,
  CalendarDays,
  Inbox,
  Settings,
  Bell,
  TicketPercent,
  type LucideIcon,
} from "lucide-react";

export interface SellerNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Exact-match active (e.g. /seller/dashboard) vs prefix-match (default). */
  exact?: boolean;
}

export interface SellerNavGroup {
  label: string;
  items: SellerNavItem[];
}

export const SELLER_NAV: SellerNavGroup[] = [
  {
    label: "Main Menu",
    items: [
      { title: "Dashboard", url: "/seller/dashboard", icon: LayoutDashboard, exact: true },
      { title: "Orders", url: "/seller/orders", icon: ShoppingBag },
      { title: "Payments", url: "/seller/payments", icon: Wallet },
    ],
  },
  {
    label: "Products",
    items: [
      { title: "Create Product", url: "/seller/products/new", icon: SquarePlus },
      { title: "All Products", url: "/seller/products", icon: Boxes, exact: true },
    ],
  },
  {
    label: "Events",
    items: [
      { title: "Create Event", url: "/seller/events/new", icon: CalendarPlus },
      { title: "All Events", url: "/seller/events", icon: CalendarDays, exact: true },
    ],
  },
  {
    label: "Controllers",
    items: [
      { title: "Inbox", url: "/seller/inbox", icon: Inbox },
      { title: "Settings", url: "/seller/settings", icon: Settings },
      { title: "Notifications", url: "/seller/notifications", icon: Bell },
    ],
  },
  {
    label: "Extras",
    items: [
      { title: "Discount Codes", url: "/seller/discount-codes", icon: TicketPercent },
    ],
  },
];
