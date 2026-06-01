// ============================================================================
// page-heading.tsx — page title with brand accent line (theme-aware)
// ============================================================================
// Vertical accent bar before the title (course pattern) — par hardcoded orange
// ki jagah `bg-primary` (light + dark adapt). Optional right-side action slot.
// ============================================================================

import { cn } from "@/lib/utils";

export function PageHeading({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          {/* brand accent line */}
          <span className="inline-block h-6 w-1 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-1 ml-3 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
