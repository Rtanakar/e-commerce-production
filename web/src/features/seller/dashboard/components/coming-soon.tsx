// ============================================================================
// coming-soon.tsx — placeholder for seller routes not yet built
// ============================================================================
// Keeps the sidebar fully navigable (no 404s) while the orders / products /
// events / etc. modules are under construction. Theme-token based.
// ============================================================================

import Link from "next/link";
import { Construction, ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComingSoon({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-7" />
        </span>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description ??
            "This section is being built. It’ll be available here soon."}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-6 gap-1.5">
          <Link href="/seller/dashboard">
            <ArrowLeft className="size-3.5" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
