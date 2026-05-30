import { SquarePlus } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerCreateProductPage() {
  return (
    <ComingSoon
      title="Create Product"
      icon={SquarePlus}
      description="Add a new product with images, pricing, and stock."
    />
  );
}
