import { CalendarPlus } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerCreateEventPage() {
  return (
    <ComingSoon
      title="Create Event"
      icon={CalendarPlus}
      description="Schedule a sale or product launch event."
    />
  );
}
