"use client";

import { Check } from "lucide-react";
import { Sheet } from "@/components/uw/sheet";
import { WikiImage } from "@/components/uw/wiki-image";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { fmtDistance } from "@/lib/geo";
import { cn } from "@/lib/utils";

export function StopListSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const { model } = useEvent();
  const { progress, distanceTo, nextStop } = useWalk();
  return (
    <Sheet open={open} onClose={onClose} label="All stops">
      <header className="flex items-end justify-between pb-4 pt-1">
        <div>
          <p className="eyebrow text-uw-slate">{model.stops.length} stops · {(model.lengthM / 1000).toFixed(1)} km</p>
          <h2 className="display mt-1 text-[34px]">The route</h2>
        </div>
      </header>
      <ol className="relative">
        <span className="absolute bottom-6 left-[27px] top-6 w-[3px] rounded bg-uw-yellow" aria-hidden />
        {model.stops.map((s) => {
          const visited = progress.visited.includes(s.id);
          const d = distanceTo(s.coord);
          const photo = s.content?.photos[0];
          return (
            <li key={s.id}>
              <button onClick={() => onPick(s.id)} className="press relative flex w-full items-center gap-3 rounded-[20px] py-2 pr-2 text-left hover:bg-white/60">
                <span className={cn("relative z-10 grid size-14 shrink-0 place-items-center overflow-hidden rounded-full ring-[3px]", visited ? "ring-uw-ink" : "ring-uw-yellow", "bg-uw-mist")}>
                  {photo ? <WikiImage photo={photo} sizes="56px" maxWidth={250} className="size-full" alt="" /> : <span className="font-semibold">{s.number}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="eyebrow tabular text-uw-slate">
                    {String(s.number).padStart(2, "0")} · {s.area}
                    {s.id === nextStop?.id && <span className="ml-1.5 rounded-full bg-uw-yellow px-1.5 py-0.5 text-uw-ink">Next</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[16px] font-semibold tracking-tight">{s.name}</span>
                </span>
                <span className="tabular shrink-0 text-right text-[12px] text-uw-slate">
                  {visited ? <Check className="ml-auto size-4 text-uw-ink" /> : d !== null ? fmtDistance(d) : `${s.routeKm.toFixed(1)} km`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
