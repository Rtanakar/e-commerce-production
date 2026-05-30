import { TicketPercent } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerDiscountCodesPage() {
  return (
    <ComingSoon
      title="Discount Codes"
      icon={TicketPercent}
      description="Create and manage promo codes for your shop."
    />
  );
}
