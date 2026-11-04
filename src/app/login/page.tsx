import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { LoginScreen } from "@/components/auth/login-screen";

export const metadata: Metadata = { title: "Sign in · URBAN WALK" };
export const viewport: Viewport = { themeColor: "#141518" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="surface-night min-h-dvh bg-uw-night" />}>
      <LoginScreen />
    </Suspense>
  );
}
