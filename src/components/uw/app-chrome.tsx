"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useDeviceTier } from "@/hooks/use-device-tier";
import { BottomNav } from "./bottom-nav";
import { Composer } from "./composer";
import { ProximityToast } from "./proximity-toast";

/**
 * Full-width shell. Each page caps its own text measure (.px-content) so phones,
 * tablets and desktops all use the whole screen without over-long lines.
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
    <div className="relative min-h-dvh w-full overflow-x-clip bg-uw-paper">
      {children}
      <BottomNav />
      <ProximityToast />
      <Composer />
    </div>
  );
}
