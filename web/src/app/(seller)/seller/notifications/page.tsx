import { Bell } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerNotificationsPage() {
  return (
    <ComingSoon
      title="Notifications"
      icon={Bell}
      description="Order alerts, stock warnings, and platform updates."
    />
  );
}
