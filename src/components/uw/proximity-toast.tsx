"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Check, X } from "lucide-react";
import { useWalk } from "@/components/providers/walk-provider";
import { fmtDistance } from "@/lib/geo";
import { WikiImage } from "./wiki-image";
import { StopBadge } from "./stop-badge";
import { settleAfter } from "@/lib/motion";

gsap.registerPlugin(useGSAP);
const AUTO_HIDE_MS = 14_000;

export function ProximityToast() {
  const { toast, dismissToast, toggleVisited, progress } = useWalk();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (toast && ref.current) return settleAfter(gsap.fromTo(ref.current, { y: -24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: "expo.out" }));
    },
    { dependencies: [toast?.at] },
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismissToast, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!toast) return <div role="status" aria-live="polite" className="sr-only" />;
  const { stop } = toast;
  const photo = stop.content?.photos[0];
  const visited = progress.visited.includes(stop.id);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 safe-top">
      <div ref={ref} role="status" aria-live="polite" className="glass pointer-events-auto w-full max-w-[416px] rounded-[26px] p-2.5">
        <div className="flex gap-3">
          <div className="relative size-[76px] shrink-0 overflow-hidden rounded-[18px] bg-uw-mist">
            {photo && <WikiImage photo={photo} sizes="76px" maxWidth={250} className="size-full" alt="" />}
            <StopBadge n={stop.number} className="absolute bottom-1 left-1" />
          </div>
          <div className="min-w-0 flex-1 py-0.5">
            <p className="eyebrow text-uw-slate">Approaching · {fmtDistance(toast.distanceM)}</p>
            <p className="mt-1 truncate text-[17px] font-semibold tracking-tight">{stop.name}</p>
            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-uw-charcoal/80">
              {stop.short || `Stop ${stop.number} of the walk · ${stop.area}`}
            </p>
          </div>
          <button onClick={dismissToast} aria-label="Dismiss" className="press grid size-8 shrink-0 place-items-center rounded-full text-uw-charcoal/60">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-2.5 flex gap-2">
          <Link
            href={`/landmark/${stop.id}`}
            onClick={dismissToast}
            className="press flex h-10 flex-1 items-center justify-center rounded-full bg-uw-yellow text-[13.5px] font-semibold"
          >
            View landmark
          </Link>
          {!visited && (
            <button
              onClick={() => { toggleVisited(stop.id); dismissToast(); }}
              className="press flex h-10 items-center gap-1.5 rounded-full bg-white/80 px-4 text-[13.5px] font-medium"
            >
              <Check className="size-4" /> Mark visited
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
