import { Suspense } from "react";
import { SignInForm } from "@/features/auth/components/signin-form";

export const metadata = {
  title: "Sign in | Eshop",
  description: "Sign in to your Eshop account",
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
