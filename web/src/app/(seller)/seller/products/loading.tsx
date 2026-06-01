// Products list route skeleton — shown during server prefetch / navigation.
// Mirrors layout: heading + 4 stat cards + search + table (zero layout shift).
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductsTableSkeleton } from "@/features/products/components/products-table";

export default function Loading() {
  return (
    <div className="w-full space-y-5 p-4 lg:p-6">
      {/* Heading */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-primary/30" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="ml-3 h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-0 p-4">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-7 w-14" />
          </Card>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      {/* Table */}
      <ProductsTableSkeleton rows={8} />
    </div>
  );
}
