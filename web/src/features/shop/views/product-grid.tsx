// ============================================================================
// product-grid.tsx — Storefront product grid + quick-view orchestration
// ============================================================================
// ProductCard render karta hai + ek shared ProductQuickView modal owns karta
// (ek hi modal, jo bhi card "eye" click kare uska product set ho jaata).
// Loading skeleton + empty state. Container-query responsive grid.
// ============================================================================

"use client";

import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "../components/product-card";
import { ProductQuickView } from "../components/product-quick-view";
import { useShopProducts } from "../hooks/use-shop-products";
import type { ShopProductsQuery } from "../api/shop-api";
import type { ShopProduct } from "../types";

interface ProductGridProps {
  query?: ShopProductsQuery;
  title?: string;
  subtitle?: string;
}

export function ProductGrid({ query = {}, title, subtitle }: ProductGridProps) {
  const { data, isLoading, isError } = useShopProducts(query);
  const [quickView, setQuickView] = useState<ShopProduct | null>(null);

  const products = data?.products ?? [];

  return (
    <section className="mx-auto w-full max-w-360 px-4 py-8 sm:px-6 lg:px-8">
      {title && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          {!isLoading && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{data?.totalCount ?? products.length}</span>{" "}
              products
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <GridSkeleton />
      ) : isError ? (
        <Empty className="rounded-2xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch />
            </EmptyMedia>
            <EmptyTitle>Couldn&apos;t load products</EmptyTitle>
            <EmptyDescription>Please refresh and try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : products.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch />
            </EmptyMedia>
            <EmptyTitle>No products found</EmptyTitle>
            <EmptyDescription>Try adjusting your search or filters.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="@container">
          <div className="grid grid-cols-2 gap-4 @md:grid-cols-3 @xl:grid-cols-4 @md:gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onQuickView={setQuickView} />
            ))}
          </div>
        </div>
      )}

      {/* Shared quick-view modal */}
      <ProductQuickView
        product={quickView}
        open={!!quickView}
        onOpenChange={(o) => !o && setQuickView(null)}
      />
    </section>
  );
}

function GridSkeleton() {
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-4 @md:grid-cols-3 @xl:grid-cols-4 @md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border p-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
