import { Suspense } from "react";
import { VerifyOtpForm } from "@/features/auth/components/verify-otp-form";

export const metadata = {
  title: "Verify email | Eshop",
};

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpForm />
    </Suspense>
  );
}
