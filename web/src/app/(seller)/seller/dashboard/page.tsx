// ============================================================================
// /seller/dashboard — Seller dashboard home
// ============================================================================
// Thin server shell. The /seller layout already guards the session; we read
// the seller again here (cheap, cached per request) to feed real shop name +
// status into the view. All heavy lifting lives in the feature view.
// ============================================================================

import type { Metadata } from "next";
import { requireSeller } from "@/lib/seller-auth/server";
import { SellerDashboardView } from "@/features/seller/dashboard/views/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard · Seller",
};

export default async function SellerDashboardPage() {
  const user = await requireSeller();
  return <SellerDashboardView user={user} />;
}
