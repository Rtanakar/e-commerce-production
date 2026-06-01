// ============================================================================
// (seller)/seller/layout.tsx — Seller dashboard shell (sidebar + header)
// ============================================================================
// Server-guarded: requireSeller() reads the seller-access-token cookie and
// verifies it against the backend. No seller session → redirect to
// /become-seller BEFORE any HTML ships (no flash, no JS-disable bypass).
//
// Chrome = Zustand-driven shadcn sidebar (SellerSidebarProvider) + sticky
// header + scrollable content. All theme-token based (light + dark).
// ============================================================================

import { SidebarInset } from "@/components/ui/sidebar";
import { requireSeller } from "@/lib/seller-auth/server";
import { SellerSidebarProvider } from "@/features/seller/dashboard/components/seller-sidebar-provider";
import { SellerDashboardSidebar } from "@/features/seller/dashboard/components/seller-dashboard-sidebar";
import { SellerDashboardHeader } from "@/features/seller/dashboard/components/seller-dashboard-header";

export default async function SellerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server guard — guaranteed VENDOR after this await
  const user = await requireSeller();

  return (
    <SellerSidebarProvider>
      {/* Sidebar fetches its own user (skeleton on first load). Header gets the
          server user for an instant greeting. */}
      <SellerDashboardSidebar />
      {/* h-svh + min-h-0 → inset viewport height pe locked; sirf main scroll */}
      <SidebarInset className="flex h-svh min-h-0 flex-col bg-muted/30">
        <SellerDashboardHeader user={user} />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </SellerSidebarProvider>
  );
}
