import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/login-screen";

export const metadata: Metadata = { title: "Sign in · URBAN WALK" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-uw-ink" />}>
      <LoginScreen />
    </Suspense>
  );
}
