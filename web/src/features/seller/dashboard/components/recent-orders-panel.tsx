// ============================================================================
// recent-orders-panel.tsx — latest orders table (mock until orders API lands)
// ============================================================================
// Compact, scannable order list with status pills. Mock data is clearly
// marked — swap to GET /seller/orders?limit=6 when the orders module exists.
// ============================================================================

"use client";

import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type OrderStatus = "pending" | "shipped" | "delivered" | "returned";

interface OrderRow {
  id: string;
  product: string;
  qty: number;
  total: string;
  date: string;
  status: OrderStatus;
}

// ── MOCK — replace with GET /seller/orders?limit=6 ──────────────────────────
const ORDERS: OrderRow[] = [
  { id: "TX52320", product: "Wireless Earbuds Pro", qty: 1, total: "$129", date: "Today, 05:41", status: "pending" },
  { id: "TX24167", product: "iPhone 15 Case", qty: 2, total: "$38", date: "Today, 12:53", status: "pending" },
  { id: "TX10934", product: "USB-C Fast Charger", qty: 1, total: "$24", date: "Yesterday", status: "shipped" },
  { id: "TX98201", product: "Laptop Sleeve 14\"", qty: 1, total: "$45", date: "Yesterday", status: "delivered" },
  { id: "TX77410", product: "Mechanical Keyboard", qty: 1, total: "$89", date: "2 days ago", status: "delivered" },
  { id: "TX65522", product: "Desk Mat XL", qty: 3, total: "$60", date: "3 days ago", status: "returned" },
];

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  shipped: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  delivered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  returned: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function RecentOrdersPanel() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="size-4" />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Recent Orders
          </h2>
        </div>
        <Link
          href="/seller/orders"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {ORDERS.map((o) => (
          <div
            key={o.id}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">
                {o.product}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                #{o.id} · Qty {o.qty} · {o.date}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {o.total}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "w-[78px] shrink-0 justify-center text-[10px] font-medium capitalize",
                STATUS_STYLE[o.status],
              )}
            >
              {o.status}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
