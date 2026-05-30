import { Inbox } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerInboxPage() {
  return (
    <ComingSoon
      title="Inbox"
      icon={Inbox}
      description="Messages from customers and support."
    />
  );
}
