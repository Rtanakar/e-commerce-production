// Discount-codes route skeleton — shown during server prefetch / navigation.
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";

export default function Loading() {
  return (
    <div className="w-full space-y-5 p-4 lg:p-6">
      {/* Heading */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-1 rounded-full bg-primary/30" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="ml-3 h-3.5 w-72" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card/40">
        <Table>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="hidden sm:table-cell"><Skeleton className="h-3 w-28" /></TableCell>
                <TableCell><Skeleton className="h-3 w-14" /></TableCell>
                <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-10 rounded-full" /></TableCell>
                <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
