import { Settings } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerSettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      icon={Settings}
      description="Shop profile, payouts, and account preferences."
    />
  );
}
