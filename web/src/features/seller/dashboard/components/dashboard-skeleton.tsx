// ============================================================================
// dashboard-skeleton.tsx — 1:1 skeleton mirror of the dashboard home
// ============================================================================
// Matches SellerDashboardView: heading + 2 KPI rows (StatCards + ProductsStats)
// + 2 analytics charts (pie donut + bar) + recent orders. Har box/graph ka
// skeleton → zero layout shift. Theme-token based.
// ============================================================================

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function StatCardRow() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="gap-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </Card>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="w-full space-y-5 p-4 lg:p-6">
      {/* Heading row (accent line + title + subtitle + CTA) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-primary/30" />
            <Skeleton className="h-6 w-36" />
          </div>
          <Skeleton className="ml-3 h-3.5 w-56" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* KPI row 1 — mock revenue/orders StatCards */}
      <StatCardRow />

      {/* KPI row 2 — live ProductsStats */}
      <StatCardRow />

      {/* Analytics charts — pie (donut) + bar */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Pie / donut */}
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="relative flex h-[240px] items-center justify-center">
              <Skeleton className="size-44 rounded-full" />
              <div className="absolute size-24 rounded-full bg-card" />
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Skeleton className="size-2.5 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bar */}
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent>
            <div className="flex h-[240px] items-end gap-4 px-2 pb-6">
              {[70, 45, 85, 55].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders panel */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
