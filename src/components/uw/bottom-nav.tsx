"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Compass, Footprints, Map as MapIcon, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWalk } from "@/components/providers/walk-provider";

const ITEMS = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/walk", label: "Map", icon: MapIcon },
  { href: "/community", label: "Discoveries", icon: MessagesSquare },
  { href: "/progress", label: "Progress", icon: Footprints },
];

/** Yellow capture button + one glass pill — mirrors the reference's bottom control. */
export function BottomNav() {
  const path = usePathname();
  const { openComposer, nextStop, geo, distanceTo } = useWalk();

  // Suggest the nearest stop as the photo's landmark only when actually near it.
  const near = nextStop && geo.status === "active" && (distanceTo(nextStop.coord) ?? Infinity) < 120 ? nextStop.id : null;

  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center safe-bottom">
      <div className="pointer-events-auto flex items-center gap-2 px-3">
        <button
          onClick={() => openComposer("photo", near)}
          className="press focus-ring grid size-[60px] place-items-center rounded-full bg-uw-yellow text-uw-ink shadow-[var(--shadow-float)] max-[359px]:size-[52px]"
          aria-label="Capture a photo"
        >
          <Camera className="size-6" strokeWidth={1.75} />
        </button>
        <div className="glass flex h-[60px] items-center gap-1 rounded-full px-1.5">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press focus-ring flex h-12 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-uw-charcoal/80",
                  active && "bg-uw-ink text-white",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
                {active && <span className="max-[359px]:sr-only">{label}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
