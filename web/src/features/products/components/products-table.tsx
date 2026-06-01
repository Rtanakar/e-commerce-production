// ============================================================================
// products-table.tsx — seller "All Products" table (skeleton + actions)
// ============================================================================

"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Boxes,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArchiveRestore,
  Star,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { ConfirmTypeDeleteDialog } from "./confirm-type-delete-dialog";
import { cn } from "@/lib/utils";
import {
  useArchiveProduct,
  useRestoreProduct,
  useDeleteProduct,
} from "../hooks/use-product-mutations";
import { PRODUCT_STATUS_META, type ProductListItem } from "../types";

// minor units → ₹ display
function money(paise: number, currency: string): string {
  const v = (paise || 0) / 100;
  if (currency === "INR") {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v.toFixed(0)}`;
  }
  return `${currency} ${v.toFixed(2)}`;
}

function HeaderRow() {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Product</TableHead>
        <TableHead className="hidden text-xs uppercase tracking-wider text-muted-foreground sm:table-cell">Status</TableHead>
        <TableHead className="hidden text-xs uppercase tracking-wider text-muted-foreground lg:table-cell">Price</TableHead>
        <TableHead className="hidden text-xs uppercase tracking-wider text-muted-foreground lg:table-cell">Stock</TableHead>
        <TableHead className="hidden text-xs uppercase tracking-wider text-muted-foreground xl:table-cell">Sold</TableHead>
        <TableHead className="hidden text-xs uppercase tracking-wider text-muted-foreground xl:table-cell">Created</TableHead>
        <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function ProductsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <Table>
        <HeaderRow />
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              <TableCell className="py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-12 rounded-md" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-28" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-3 w-14" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-3 w-10" /></TableCell>
              <TableCell className="hidden xl:table-cell"><Skeleton className="h-3 w-10" /></TableCell>
              <TableCell className="hidden xl:table-cell"><Skeleton className="h-3 w-20" /></TableCell>
              <TableCell className="text-right"><Skeleton className="ml-auto size-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Row({ product }: { product: ProductListItem }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const archive = useArchiveProduct();
  const restore = useRestoreProduct();
  const del = useDeleteProduct();
  const statusMeta = PRODUCT_STATUS_META[product.status];
  const img = product.images?.[0]?.url;
  const isDeleted = product.status === "DELETED";
  // Restore ARCHIVED ya DELETED dono se → DRAFT
  const canRestore = product.status === "ARCHIVED" || isDeleted;
  // DELETED products ka 24h purge countdown ("23h left")
  const hoursLeft =
    isDeleted && product.purgeAt
      ? Math.max(
          0,
          Math.ceil((new Date(product.purgeAt).getTime() - Date.now()) / 3_600_000),
        )
      : null;

  return (
    <>
      <motion.tr
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="group border-b border-border transition-colors hover:bg-muted/40"
      >
        <TableCell className="py-3">
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              {img ? (
                <Image src={img} alt={product.title} fill sizes="48px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Boxes className="size-5 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <Link
                href={`/seller/products/${product.id}/edit`}
                className="block max-w-[22rem] truncate text-sm font-medium transition-colors hover:text-primary"
              >
                {product.title}
              </Link>
              <p className="mt-0.5 max-w-[22rem] truncate font-mono text-[11px] text-muted-foreground">
                /{product.slug}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          <Badge variant="outline" className={cn("text-[10px] font-medium", statusMeta.tone)}>
            {statusMeta.label}
          </Badge>
          {hoursLeft !== null && (
            <span className="mt-1 block text-[10px] text-rose-500">{hoursLeft}h left</span>
          )}
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <div className="flex flex-col">
            <span className="text-xs font-semibold tabular-nums">{money(product.salePrice, product.currency)}</span>
            {product.discountPercent > 0 && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{product.discountPercent}% off</span>
            )}
          </div>
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          <span className={cn("text-xs tabular-nums", product.stock === 0 ? "text-rose-500" : "text-muted-foreground")}>
            {product.stock}
          </span>
        </TableCell>
        <TableCell className="hidden xl:table-cell">
          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            {product.soldCount}
            {product.ratingAvg > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-500">
                <Star className="size-3 fill-amber-500" />
                {product.ratingAvg.toFixed(1)}
              </span>
            )}
          </span>
        </TableCell>
        <TableCell className="hidden xl:table-cell">
          <span className="font-mono text-[11px] text-muted-foreground">
            {format(new Date(product.createdAt), "dd MMM yyyy")}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/seller/products/${product.id}/edit`} className="gap-2">
                  <Pencil className="size-3.5" /> Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/products/${product.slug}`} target="_blank" className="gap-2">
                  <Eye className="size-3.5" /> View public
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canRestore ? (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() =>
                    toast.promise(restore.mutateAsync(product.id), { loading: "Restoring…", success: "Restored to draft", error: "Failed" })
                  }
                >
                  <ArchiveRestore className="size-3.5" /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() =>
                    toast.promise(archive.mutateAsync(product.id), { loading: "Archiving…", success: "Archived", error: "Failed" })
                  }
                >
                  <ArchiveRestore className="size-3.5" /> Archive
                </DropdownMenuItem>
              )}
              {/* Delete sirf jab pehle se DELETED na ho (warna sirf Restore relevant hai) */}
              {!isDeleted && (
                <DropdownMenuItem variant="destructive" className="gap-2" onSelect={(e) => { e.preventDefault(); setDeleteOpen(true); }}>
                  <Trash2 className="size-3.5" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </motion.tr>

      {/* Type-"delete" confirm — edit page jaisa industry-grade (permanent) */}
      <ConfirmTypeDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this product?"
        description={
          <>
            <span className="font-medium text-foreground">{product.title}</span>{" "}
            will be moved to a <span className="font-medium">delete state</span> and
            permanently removed from storage &amp; the database{" "}
            <span className="font-medium">after 24 hours</span>. You can restore it
            within this time.
          </>
        }
        onConfirm={async () => {
          await toast
            .promise(del.mutateAsync(product.id), {
              loading: `Deleting "${product.title}"…`,
              success: "Moved to delete state — recover within 24h",
              error: (err) => (err instanceof Error ? err.message : "Failed"),
            })
            .unwrap();
        }}
      />
    </>
  );
}

export function ProductsTable({
  items,
  isFetching,
  hasFilters,
}: {
  items: ProductListItem[];
  isFetching?: boolean;
  hasFilters: boolean;
}) {
  if (items.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed border-border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Boxes /></EmptyMedia>
          <EmptyTitle>{hasFilters ? "No products match your filters" : "No products yet"}</EmptyTitle>
          <EmptyDescription>
            {hasFilters ? "Try adjusting the search or filters." : "Create your first product to get started."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card/40 transition-opacity", isFetching && "opacity-60")}>
      <Table>
        <HeaderRow />
        <TableBody>
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((p) => (
              <Row key={p.id} product={p} />
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}
