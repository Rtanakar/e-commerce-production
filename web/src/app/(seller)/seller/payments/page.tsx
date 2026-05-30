import { Wallet } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerPaymentsPage() {
  return (
    <ComingSoon
      title="Payments"
      icon={Wallet}
      description="Payouts, balance, and transaction history."
    />
  );
}
