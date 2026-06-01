// ============================================================================
// seller-dashboard-header.tsx — Top bar: trigger + greeting + actions
// ============================================================================
// Sticky, theme-token driven. Left: sidebar trigger + greeting. Right: quick
// links (inbox, notifications), theme toggle. The trigger toggles the Zustand
// store via shadcn's SidebarTrigger (which calls our controlled onOpenChange).
// ============================================================================

"use client";

import Link from "next/link";
import { Bell, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AuthUser } from "@/lib/auth/api";

export function SellerDashboardHeader({ user }: { user: AuthUser }) {
  const firstName = user.name?.split(" ")[0] ?? "Seller";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      {/* Left — trigger + greeting */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <div className="leading-tight">
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            {firstName} 👋
          </h1>
        </div>
      </div>

      {/* Right — quick actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/seller/inbox" aria-label="Inbox">
            <Inbox className="size-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/seller/notifications" aria-label="Notifications">
            <Bell className="size-4" />
            {/* Unread dot — wire to real count later */}
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
          </Link>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ThemeToggle />
      </div>
    </header>
  );
}
