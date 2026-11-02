"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDeviceTier } from "@/hooks/use-device-tier";
import { BottomNav } from "./bottom-nav";
import { Composer } from "./composer";
import { ProximityToast } from "./proximity-toast";

/**
 * Phone-width shell. On desktop the app sits in a centred column, the way the
 * references present it, instead of stretching a mobile layout across a monitor.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { lowPower } = useDeviceTier();
  // full-screen pages without the bottom nav
  const bare = path.startsWith("/admin") || path.startsWith("/login");

  useEffect(() => {
    document.documentElement.classList.toggle("lowfx", lowPower);
  }, [lowPower]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline caching is a progressive enhancement */
      });
    }
  }, []);

  if (bare) return <>{children}</>;
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[440px] overflow-x-clip bg-uw-paper md:shadow-[0_0_80px_-20px_rgba(0,0,0,0.25)]">
      {children}
      <BottomNav />
      <ProximityToast />
      <Composer />
    </div>
  );
}
