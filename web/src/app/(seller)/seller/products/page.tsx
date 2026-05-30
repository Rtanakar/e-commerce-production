import { Boxes } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerProductsPage() {
  return (
    <ComingSoon
      title="All Products"
      icon={Boxes}
      description="Your catalogue — edit, publish, and track stock."
    />
  );
}
