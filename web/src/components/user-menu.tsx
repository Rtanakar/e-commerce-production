// ============================================================================
// user-menu.tsx — Header user dropdown (Amazon/Flipkart pattern)
// ============================================================================
// Three states - same component, switched by auth state:
//   1. pending   → skeleton (no first-paint layout shift)
//   2. signed-in → "Hello, {firstName}" + avatar → dropdown (orders/profile/etc)
//   3. anon      → "Hello, Sign In" link (NO dropdown, single click → /sign-in)
//
// Why one component for all 3 states?
//   - Header layout stable across auth transitions (no jumpy width)
//   - Single source of truth for auth-UI mapping
//
// Animations via `motion` v12:
//   - Anon CTA: tiny lift on mount (subtle "I'm here" cue)
//   - Signed-in chip: same enter + chevron 180° on open
//   - Dropdown content: fade + slight Y slide (orchestrated stagger)
// ============================================================================

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Package,
  Heart,
  Settings,
  Store,
  User as UserIcon,
  MapPin,
  Receipt,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/guards";
import { useSignOut } from "@/lib/auth/hooks";
import { cn } from "@/lib/utils";
import { sellerUrl } from "@/lib/portal-urls";

const EASE = [0.16, 1, 0.3, 1] as const;

// First letter of first 2 words → fallback avatar (e.g. "Shahriar Khan" → "SK")
function getInitials(name?: string | null): string {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// UserMenu - main export
// ============================================================================
export function UserMenu() {
  const { user, isAuthenticated, isPending } = useAuth();
  const signOut = useSignOut();
  const router = useRouter();

  // ----- 1. Pending → skeleton -----
  if (isPending) return <UserMenuSkeleton />;

  // ----- 2. Anon → "Hello, Sign In" CTA (no dropdown) -----
  if (!isAuthenticated || !user) return <SignInChip />;

  // ----- 3. Signed-in → avatar chip + dropdown -----
  const displayName = user.name ?? user.email.split("@")[0] ?? "Account";
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const isVendor = user.role === "VENDOR";
  const isAdmin = user.role === "ADMIN";

  const handleSignOut = () => {
    // toast.promise async chain - shows loading/success/error states inline
    const p = signOut.mutateAsync().then(() => {
      router.push("/");
      router.refresh(); // re-fetch RSC tree (clears any SSR'd user data)
    });
    toast.promise(p, {
      loading: "Signing out…",
      success: "See you soon 👋",
      error: "Could not sign out, please try again.",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          type="button"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3",
            "transition-all hover:border-primary/30 hover:bg-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Avatar className="size-7">
            <AvatarImage src={user.image ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          {/* sm+: "Hello, {firstName}" - mobile collapses to just avatar */}
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-[10px] text-muted-foreground">Hello,</span>
            <span className="max-w-24 truncate text-xs font-semibold">
              {firstName}
            </span>
          </span>
          <ChevronDown
            className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-64 overflow-hidden p-0"
      >
        {/* Motion wrapper for fade + slide-in on open */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          {/* ----- Header label - avatar + name + email ----- */}
          <DropdownMenuLabel className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
            <Avatar className="size-10">
              <AvatarImage src={user.image ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
              {/* Role badge - VENDOR/ADMIN visible, CUSTOMER hidden (default) */}
              {(isAdmin || isVendor) && (
                <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {user.role}
                </span>
              )}
            </div>
          </DropdownMenuLabel>

          <div className="p-1">
            {/* ===== Staff dashboards - top priority for staff users ===== */}
            {isAdmin && (
              <MenuLink href="/admin" icon={LayoutDashboard}>
                Admin Dashboard
              </MenuLink>
            )}
            {/* Seller dashboard lives on the seller subdomain (separate cookie
                jar) → cross-host <a>, not next/link. Only shown to VENDORs. */}
            {isVendor && (
              <DropdownMenuItem asChild>
                <a
                  href={sellerUrl("/seller/dashboard")}
                  className="flex cursor-pointer items-center gap-2 rounded-md"
                >
                  <Store className="size-4 text-muted-foreground" />
                  <span>Seller Dashboard</span>
                </a>
              </DropdownMenuItem>
            )}

            {(isAdmin || isVendor) && (
              <DropdownMenuSeparator className="my-1" />
            )}

            {/* ===== Customer items - shown to ALL logged-in users ===== */}
            <MenuLink href="/profile" icon={UserIcon}>
              Your Profile
            </MenuLink>
            <MenuLink href="/orders" icon={Package}>
              Your Orders
            </MenuLink>
            <MenuLink href="/wishlist" icon={Heart}>
              Your Wishlist
            </MenuLink>
            <MenuLink href="/addresses" icon={MapPin}>
              Addresses
            </MenuLink>
            <MenuLink href="/invoices" icon={Receipt}>
              Invoices
            </MenuLink>
            <MenuLink href="/settings" icon={Settings}>
              Settings
            </MenuLink>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              onClick={handleSignOut}
              disabled={signOut.isPending}
              className="flex cursor-pointer items-center gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="size-4" />
              {signOut.isPending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </div>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Internal - MenuLink wrapper (icon + label + asChild Link)
// ============================================================================
function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem asChild>
      <Link
        href={href}
        className="flex cursor-pointer items-center gap-2 rounded-md"
      >
        <Icon className="size-4 text-muted-foreground" />
        <span>{children}</span>
      </Link>
    </DropdownMenuItem>
  );
}

// ============================================================================
// UserMenuSkeleton - same shape as signed-in chip (zero layout shift)
// ============================================================================
function UserMenuSkeleton() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-3">
      <Skeleton className="size-7 shrink-0 rounded-full" />
      <div className="hidden flex-col gap-1 sm:flex">
        <Skeleton className="h-2 w-10 rounded" />
        <Skeleton className="h-2.5 w-14 rounded" />
      </div>
      <ChevronDown className="size-3.5 text-muted-foreground/40" />
    </div>
  );
}

// ============================================================================
// SignInChip - anon state CTA ("Hello, Sign In")
// ============================================================================
// Matches Amazon's header anon affordance:
//   tiny user icon + two-line label "Hello,\nSign In"
// No dropdown - direct link to /sign-in
// ============================================================================
function SignInChip() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <Link
        href="/sign-in"
        className={cn(
          "group inline-flex items-center gap-2 rounded-full px-3 py-1.5",
          "transition-colors hover:bg-accent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <UserIcon className="size-5 text-foreground/70 transition-transform group-hover:scale-110" />
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-[10px] text-muted-foreground">Hello,</span>
          <span className="text-xs font-semibold">Sign In</span>
        </span>
      </Link>
    </motion.div>
  );
}
