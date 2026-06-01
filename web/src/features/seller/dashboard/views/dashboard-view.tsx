// ============================================================================
// dashboard-view.tsx — Seller dashboard home (composed)
// ============================================================================
// Layout:
//   • Heading row — shop name + live status badge + "New Product" CTA
//   • StatCards   — Revenue / Orders / Avg Order / Pending  (MOCK KPIs)
//   • AiInsightsPanel (2/3) + RecentOrdersPanel (1/3) on xl
//
// KPIs/orders/insights are clearly-marked MOCK data — the real numbers come
// online when the seller products/orders/analytics modules land. Shop name +
// status are REAL (from the verified seller session).
// ============================================================================
"use client";

import Link from "next/link";
import { Wallet, ShoppingBag, Receipt, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AuthUser } from "@/lib/auth/api";
import { StatCards, type StatItem } from "../components/stat-cards";
import { RecentOrdersPanel } from "../components/recent-orders-panel";
import { ProductsStats } from "@/features/products/components/products-stats";
import {
  CategoryPieChart,
  StatusBarChart,
} from "@/features/products/components/analytics-charts";

// ── MOCK KPIs — replace with GET /seller/stats ──────────────────────────────
const STATS: StatItem[] = [
  {
    label: "Revenue (7d)",
    value: "$3,149",
    delta: 18,
    deltaLabel: "vs last week",
    icon: Wallet,
  },
  {
    label: "Orders (7d)",
    value: "42",
    delta: 12,
    deltaLabel: "vs last week",
    icon: ShoppingBag,
  },
  {
    label: "Avg. Order",
    value: "$74.98",
    delta: 4,
    deltaLabel: "vs last week",
    icon: Receipt,
  },
  {
    label: "Pending",
    value: "4",
    delta: -2,
    deltaLabel: "to ship",
    icon: Clock,
  },
];

export function SellerDashboardView({ user }: { user: AuthUser }) {
  const shopName = user.vendorProfile?.shopName ?? user.name ?? "your shop";
  const status = user.vendorProfile?.status;
  const underReview = status === "PENDING_REVIEW";

  return (
    <div className="w-full space-y-5 p-4 lg:p-6">
      {/* Heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-2xl">
              Dashboard
            </h1>
            {underReview && (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-[10px] font-medium text-amber-600 dark:text-amber-400"
              >
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                </span>
                Quality review
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Overview of{" "}
            <span className="font-medium text-foreground">{shopName}</span>
          </p>
        </div>

        <Button asChild size="sm" className="gap-1.5">
          <Link href="/seller/products/new">
            <Plus className="size-4" />
            New Product
          </Link>
        </Button>
      </div>

      {/* Revenue/orders KPIs (MOCK until orders module lands) */}
      <StatCards stats={STATS} />

      {/* Real catalogue KPIs (live product counts) */}
      <ProductsStats />

      {/* Analytics charts — category pie + status bar (REAL data) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryPieChart />
        <StatusBarChart />
      </div>

      {/* Recent orders (MOCK until orders module) */}
      <RecentOrdersPanel />
    </div>
  );
}
