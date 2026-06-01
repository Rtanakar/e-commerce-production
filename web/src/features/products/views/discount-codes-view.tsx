// ============================================================================
// discount-codes-view.tsx — /seller/discount-codes (table + search + filter)
// ============================================================================
// Products list ka same architecture: nuqs URL state + debounced search +
// status filter + server prefetch (HydrateClient) + keepPreviousData table +
// pagination. Actions: active-toggle, edit, delete. 4-export composition.
// ============================================================================

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  TicketPercent,
  Trash2,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/shared/page-heading";
import { PaginationControls } from "@/components/shared/pagination-controls";
import {
  useDiscountList,
  useDeleteDiscount,
  useUpdateDiscount,
} from "../hooks/use-discounts";
import { DiscountCreateDialog } from "../components/discount-create-dialog";
import { DISCOUNT_STATUS_FILTERS } from "../server/discount-params-loader";
import type { DiscountCode } from "../types";

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  active: "Active",
  inactive: "Inactive",
};

function valueLabel(dc: DiscountCode): string {
  return dc.type === "PERCENT"
    ? `${dc.value}%`
    : `₹${(dc.value / 100).toFixed(0)}`;
}

// ─── Container ───
export function DiscountCodesContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-full space-y-5 p-4 lg:p-6">{children}</div>;
}

// ─── Error ───
export function DiscountCodesError({
  error,
  resetErrorBoundary,
}: {
  error?: Error;
  resetErrorBoundary?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/30 bg-destructive/5 py-16 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/15">
        <AlertCircle className="size-6 text-destructive" />
      </span>
      <p className="font-medium">Failed to load discount codes</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {error?.message ?? "Please try again."}
      </p>
      {resetErrorBoundary && (
        <Button
          variant="outline"
          size="sm"
          onClick={resetErrorBoundary}
          className="mt-4 gap-1.5"
        >
          <RotateCcw className="size-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

function DiscountHeaderRow() {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
          Code
        </TableHead>
        <TableHead className="hidden text-xs uppercase tracking-wider text-muted-foreground sm:table-cell">
          Title
        </TableHead>
        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
          Value
        </TableHead>
        <TableHead className="hidden text-xs uppercase tracking-wider text-muted-foreground md:table-cell">
          Uses
        </TableHead>
        <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">
          Active
        </TableHead>
        <TableHead className="w-24 text-right">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <Table>
        <DiscountHeaderRow />
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-3 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-14" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-3 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-10 rounded-full" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-8 w-16" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Row({
  dc,
  onEdit,
  onDelete,
}: {
  dc: DiscountCode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateDiscount();
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="group border-b border-border transition-colors hover:bg-muted/40"
    >
      <TableCell className="py-3">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-sm font-semibold text-primary">
          {dc.code}
        </span>
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
        {dc.title || "—"}
      </TableCell>
      <TableCell>
        <span className="text-xs font-medium tabular-nums">
          {valueLabel(dc)}
        </span>
        <span className="ml-1 text-[10px] text-muted-foreground">
          {dc.type === "PERCENT" ? "off" : "flat"}
        </span>
      </TableCell>
      <TableCell className="hidden text-xs tabular-nums text-muted-foreground md:table-cell">
        {dc.usedCount}
        {dc.maxUses ? ` / ${dc.maxUses}` : ""}
      </TableCell>
      <TableCell>
        <Switch
          checked={dc.isActive}
          disabled={update.isPending}
          onCheckedChange={(v) =>
            toast.promise(
              update.mutateAsync({ id: dc.id, data: { isActive: v } }),
              {
                loading: v ? "Activating…" : "Deactivating…",
                success: v ? "Code activated" : "Code deactivated",
                error: "Failed",
              },
            )
          }
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-rose-500"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </motion.tr>
  );
}

// ─── Content ───
export function DiscountCodesContent() {
  const {
    items,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refetch,
    totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    searchValue,
    onSearchChange,
    status,
    hasFilters,
    setStatus,
    clearFilters,
    page,
    pageSize,
    goToPage,
    goNext,
    goPrev,
  } = useDiscountList();

  const del = useDeleteDiscount();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [deleting, setDeleting] = useState<DiscountCode | null>(null);

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeading
        title="Discount codes"
        description="Create codes buyers redeem at checkout. Attach them to products."
        action={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" /> New code
          </Button>
        }
      />

      {/* Search + status filter */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search code or title…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        >
          <SelectTrigger className="h-9 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISCOUNT_STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-xs text-muted-foreground"
          >
            <X className="size-3" /> Clear
          </Button>
        )}
      </div>

      {/* Count */}
      <div className="flex items-center justify-end">
        <span className="text-xs text-muted-foreground">
          {isLoading ? (
            <span className="animate-pulse">Loading…</span>
          ) : (
            <>
              {totalCount} code{totalCount !== 1 ? "s" : ""}
              {isFetching && (
                <span className="ml-2 inline-block size-1.5 animate-pulse rounded-full bg-primary" />
              )}
            </>
          )}
        </span>
      </div>

      {/* Table */}
      {isLoading || isPlaceholderData ? (
        <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} />
      ) : isError && items.length === 0 ? (
        <DiscountCodesError
          error={error as Error}
          resetErrorBoundary={() => refetch()}
        />
      ) : items.length === 0 ? (
        <Empty className="rounded-xl border border-dashed border-border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TicketPercent />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilters
                ? "No codes match your filters"
                : "No discount codes yet"}
            </EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? "Try a different search or filter."
                : "Create your first code to offer deals."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-card/40 transition-opacity",
            isFetching && "opacity-60",
          )}
        >
          <Table>
            <DiscountHeaderRow />
            <TableBody>
              <AnimatePresence mode="popLayout" initial={false}>
                {items.map((dc) => (
                  <Row
                    key={dc.id}
                    dc={dc}
                    onEdit={() => setEditing(dc)}
                    onDelete={() => setDeleting(dc)}
                  />
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 0 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          isFetching={isFetching}
          onNextPage={goNext}
          onPreviousPage={goPrev}
          onPageChange={goToPage}
        />
      )}

      {/* Create / Edit dialogs */}
      <DiscountCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DiscountCreateDialog
        open={editing !== null}
        edit={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => setEditing(null)}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this code?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono font-medium">{deleting?.code}</span>{" "}
              will be removed and detached from products.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="gap-2 bg-destructive text-white hover:bg-destructive/90"
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deleting) return;
                const p = del.mutateAsync(deleting.id);
                toast.promise(p, {
                  loading: "Deleting…",
                  success: "Code deleted",
                  error: "Failed",
                });
                p.finally(() => setDeleting(null));
              }}
            >
              {del.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
