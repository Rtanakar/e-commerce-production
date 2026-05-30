import { ShoppingBag } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerOrdersPage() {
  return (
    <ComingSoon
      title="Orders"
      icon={ShoppingBag}
      description="Track, fulfil, and manage customer orders here."
    />
  );
}
