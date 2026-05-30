// Dashboard page loading UI — shown while the page's server work (session
// verify) resolves. Mirrors the real content so there's no layout shift.
import { DashboardSkeleton } from "@/features/seller/dashboard/components/dashboard-skeleton";

export default function Loading() {
  return <DashboardSkeleton />;
}
