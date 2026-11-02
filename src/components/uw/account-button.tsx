"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { displayName, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Avatar when signed in, "Sign in" pill otherwise. `tone` matches the surface it sits on. */
export function AccountButton({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { ready, account } = useAuth();
  const path = usePathname();
  if (!ready) return <span className={cn("size-10", className)} />;
  const href = `/login?next=${encodeURIComponent(path)}`;
  if (account) {
    return (
      <Link href={href} aria-label={`Account: ${displayName(account)}`} className={cn("press focus-ring grid size-10 place-items-center rounded-full bg-uw-yellow text-[15px] font-semibold text-uw-ink", className)}>
        {displayName(account).slice(0, 1).toUpperCase()}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "press focus-ring flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
        tone === "dark" ? "glass-dark" : "bg-white text-uw-ink shadow-sm",
        className,
      )}
    >
      <UserRound className="size-4" /> Sign in
    </Link>
  );
}
