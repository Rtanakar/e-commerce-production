// ============================================================================
// dashboard-skeleton.tsx — 1:1 skeleton mirror of the dashboard home content
// ============================================================================
// Matches SellerDashboardView layout (heading + 4 stat cards + insights/orders)
// so there's zero layout shift when real data lands. Theme-token based.
// ============================================================================

import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-4 lg:p-6">
      {/* Heading row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-0 p-4">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-2 h-3 w-28" />
          </Card>
        ))}
      </div>

      {/* Insights + orders */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="gap-0 p-0 xl:col-span-2">
          <div className="border-b border-border p-4">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="grid gap-px bg-border md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, c) => (
              <div key={c} className="space-y-3 bg-card p-4">
                <Skeleton className="h-3 w-24" />
                {Array.from({ length: 3 }).map((__, r) => (
                  <Skeleton key={r} className="h-3 w-full" />
                ))}
              </div>
            ))}
          </div>
        </Card>

        <Card className="gap-0 p-0 xl:col-span-1">
          <div className="border-b border-border p-4">
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
