import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/features/seller/dashboard/components/coming-soon";

export default function SellerEventsPage() {
  return (
    <ComingSoon
      title="All Events"
      icon={CalendarDays}
      description="Flash sales, launches, and promotional events."
    />
  );
}
