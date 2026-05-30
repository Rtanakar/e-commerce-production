// ============================================================================
// seller-dashboard-sidebar.tsx — Seller portal sidebar (theme-aware, shadcn)
// ============================================================================
// Mirrors the seller-dashboard reference layout:
//   • Header  → shop avatar + shop name + address (h-14, border aligns with
//               the page header's bottom border)
//   • Body    → grouped nav (Main Menu / Products / Events / Controllers / Extras)
//   • Footer  → profile card → dropdown (profile, settings, logout)
//
// Shop header + profile read the seller via useSellerMe and show skeletons
// while the query resolves on first mount — same pattern as the customer
// UserMenu. The /seller layout's server guard already verified the session;
// this client fetch just hydrates the display (cached 5min after first load).
//
// 100% design-token driven (bg-sidebar, bg-primary, border-sidebar-border, …)
// so it adapts to light AND dark — no hardcoded hex.
// ============================================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Store,
  MapPin,
  LogOut,
  ChevronsUpDown,
  UserRound,
  Settings,
  LifeBuoy,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getInitials } from "@/lib/utils";
import { sellerAuthApi, clearSellerCsrfToken } from "@/lib/seller-auth/api";
import type { AuthUser } from "@/lib/auth/api";
import { shopUrl } from "@/lib/portal-urls";
import { useSellerMe } from "../../hooks/use-seller-me";
import { SELLER_NAV } from "../config/nav";

export function SellerDashboardSidebar() {
  const pathname = usePathname();
  // Fetch on mount → skeleton until resolved (UserMenu pattern). Cached 5min.
  const { data: user } = useSellerMe();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      {/* ── Header — shop identity (h-14 so its border aligns with page header) ── */}
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-2 py-0">
        {user ? <ShopBrand user={user} /> : <ShopBrandSkeleton />}
      </SidebarHeader>

      {/* ── Body — grouped nav ── */}
      <SidebarContent className="gap-0 py-1">
        {SELLER_NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.url
                    : pathname === item.url ||
                      pathname.startsWith(`${item.url}/`);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={cn(
                          "h-9 text-[13px] font-medium",
                          "data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary",
                        )}
                      >
                        <Link href={item.url} prefetch>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer — profile dropdown (or skeleton) ── */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            {user ? <ProfileDropdown user={user} /> : <ProfileSkeleton />}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// ============================================================================
// ShopBrand — avatar + shop name + address line
// ============================================================================
function ShopBrand({ user }: { user: AuthUser }) {
  const shopName = user.vendorProfile?.shopName ?? user.name ?? "Your Shop";
  return (
    <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Store className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
          {shopName}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <MapPin className="size-2.5 shrink-0" />
          <span className="truncate">Seller Dashboard</span>
        </p>
      </div>
    </div>
  );
}

function ShopBrandSkeleton() {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="size-9 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-2.5 w-20 rounded" />
      </div>
    </div>
  );
}

// ============================================================================
// ProfileDropdown — bottom-anchored account card
// ============================================================================
function ProfileDropdown({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const initials = getInitials(user.name);
  const status = user.vendorProfile?.status;

  const handleSignOut = async () => {
    try {
      await sellerAuthApi.signOut();
    } catch {
      // httpOnly cookie is cleared server-side regardless; just move the user.
    } finally {
      clearSellerCsrfToken();
      toast.success("Signed out");
      window.location.href = shopUrl("/");
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2 py-2 text-left transition-colors",
            "hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            "group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0",
          )}
        >
          <Avatar className="size-7 rounded-md">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name ?? "Seller"} />
            ) : null}
            <AvatarFallback className="rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-semibold leading-none text-sidebar-foreground">
              {user.name ?? "Seller"}
            </p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">
              {user.email}
            </p>
          </div>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="ml-auto shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
          >
            <ChevronsUpDown className="size-3.5" />
          </motion.span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={10}
        className="w-60 rounded-xl"
      >
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar className="size-8 rounded-md">
            {user.image ? (
              <AvatarImage src={user.image} alt={user.name ?? "Seller"} />
            ) : null}
            <AvatarFallback className="rounded-md bg-primary text-[12px] font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight">
              {user.name ?? "Seller"}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>

        {status && (
          <div className="px-2 pb-2">
            <Badge variant="secondary" className="text-[10px] font-medium">
              {status.replaceAll("_", " ").toLowerCase()}
            </Badge>
          </div>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/seller/settings" className="cursor-pointer gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/seller/settings" className="cursor-pointer gap-2">
              <Settings className="size-4 text-muted-foreground" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={shopUrl("/")} className="cursor-pointer gap-2">
              <LifeBuoy className="size-4 text-muted-foreground" />
              Back to shop
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void handleSignOut();
          }}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2 py-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
      <Skeleton className="size-7 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-1.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-2.5 w-28 rounded" />
      </div>
      <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground/40 group-data-[collapsible=icon]:hidden" />
    </div>
  );
}
