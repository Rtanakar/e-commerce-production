// ============================================================================
// sonner.tsx — Themed Toaster (shadcn tokens, light + dark auto)
// ============================================================================
// All colors come from CSS variables defined in globals.css:
//   --background / --foreground   → toast surface + text
//   --popover                     → slightly elevated surface (used as bg)
//   --border / --primary / --ring → accents
//   --destructive / --primary     → error / success borders
//
// Why no hardcoded hex? It would lock the toast to one theme. Using shadcn
// tokens means switching to dark mode (or rebranding) auto-propagates here.
// Industry: Vercel, Linear, Cal.com - same pattern.
// ============================================================================

"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // bottom-right default - matches Vercel/Linear; non-blocking corner
      position="bottom-right"
      // 4.5s - long enough to read, short enough to not stack
      duration={4500}
      closeButton
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-500" />,
        info: <InfoIcon className="size-4 text-sky-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      // CSS variable overrides that Sonner reads internally - mapped to
      // shadcn tokens so the toast inherits the app's color system
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--popover)",
          "--success-text": "var(--popover-foreground)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--popover-foreground)",
          "--error-border": "var(--border)",
          "--border-radius": "calc(var(--radius) + 4px)",
        } as React.CSSProperties
      }
      toastOptions={{
        // Tailwind utility classes - all theme tokens, zero hardcoded color.
        // !important via `!` prefix needed because Sonner sets inline styles.
        classNames: {
          toast: [
            "group toast",
            "!rounded-xl !border !bg-popover !text-popover-foreground",
            "!shadow-lg !shadow-foreground/10",
            "!backdrop-blur supports-[backdrop-filter]:!bg-popover/95",
            "!px-4 !py-3 !gap-3",
            "[font-family:var(--font-sans)]",
          ].join(" "),
          title: "!text-sm !font-semibold !text-foreground",
          description: "!text-xs !text-muted-foreground",
          // Action = primary CTA (e.g. "Undo")
          actionButton:
            "!bg-primary !text-primary-foreground !rounded-md !px-3 !py-1.5 !text-xs !font-medium hover:!bg-primary/90",
          // Cancel = secondary muted action
          cancelButton:
            "!bg-muted !text-muted-foreground !rounded-md !px-3 !py-1.5 !text-xs !font-medium hover:!bg-muted/80",
          // Close (x) - subtle, theme-bordered
          closeButton:
            "!bg-popover !border !border-border !text-muted-foreground hover:!text-foreground hover:!bg-accent",
          // Status-tinted left border accents (subtle, not full bg flood)
          // Mirrors GitHub/Linear pattern - readable while signaling status
          success:
            "!border-l-4 !border-l-emerald-500 dark:!border-l-emerald-400",
          error: "!border-l-4 !border-l-destructive",
          warning: "!border-l-4 !border-l-amber-500 dark:!border-l-amber-400",
          info: "!border-l-4 !border-l-sky-500 dark:!border-l-sky-400",
          loading:
            "!border-l-4 !border-l-muted-foreground/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
