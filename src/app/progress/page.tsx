"use client";

import { AccountButton } from "@/components/uw/account-button";
import { Wordmark } from "@/components/uw/brand";
import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { fmtDistance, fmtMinutes } from "@/lib/geo";
import { cn } from "@/lib/utils";

export default function ProgressPage() {
  const { model } = useEvent();
  const { progress, coveredM, fraction, nextStop, toggleVisited, resetProgress, posts } = useWalk();
  const total = model.stops.length;
  const done = progress.visited.length;
  const remainingM = model.lengthM - coveredM;
  const remainingStops = total - done;
  const remainingMin = (remainingM / 1000 / model.event.walking_speed_kmh) * 60 + remainingStops * model.event.dwell_minutes_per_stop;
  const current = nextStop?.number ?? total;

  return (
    <main className="px-content min-h-dvh pb-36 safe-top">
      <div className="flex items-center justify-between pt-4">
        <Wordmark className="w-[118px] text-uw-ink" />
        <AccountButton />
      </div>
      <header className="pt-5">
        <p className="eyebrow text-uw-slate">Walking progress</p>
        <h1 className="display tabular mt-2 text-[clamp(56px,20vw,112px)]">
          {String(current).padStart(2, "0")}<span className="text-uw-line"> / {String(total).padStart(2, "0")}</span>
        </h1>
        <p className="mt-1 text-[15px] text-uw-charcoal/80">
          {nextStop ? <>Next: <Link className="font-semibold underline underline-offset-2" href={`/landmark/${nextStop.id}`}>{nextStop.name}</Link></> : "Every stop explored. Well walked."}
        </p>
      </header>

      {/* route bar with stop ticks at their real positions */}
      <div className="relative mt-7 h-3 rounded-full bg-uw-mist" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-label="Route covered">
        <div className="absolute inset-y-0 left-0 rounded-full bg-uw-green text-uw-on-accent" style={{ width: `${fraction * 100}%` }} />
        {model.stops.map((s) => (
          <span key={s.id} className={cn("absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-uw-paper", progress.visited.includes(s.id) ? "bg-uw-ink" : "bg-uw-slate/50")} style={{ left: `${(s.routeKm * 1000 / model.lengthM) * 100}%` }} />
        ))}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2">
        {[
          ["Explored", `${done} ${done === 1 ? "location" : "locations"}`],
          ["Remaining", `${remainingStops} ${remainingStops === 1 ? "stop" : "stops"}`],
          ["Covered", fmtDistance(coveredM)],
          ["To go", `${fmtDistance(remainingM)} · ${fmtMinutes(remainingMin)}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[20px] bg-uw-surface p-4">
            <dt className="eyebrow text-uw-slate">{k}</dt>
            <dd className="tabular mt-1.5 text-[18px] font-semibold tracking-tight">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11.5px] text-uw-slate">
        Distance covered follows your furthest visited stop, or your GPS position on the route if it is further.
      </p>

      <ol className="mt-7 flex flex-col">
        {model.stops.map((s) => {
          const visited = progress.visited.includes(s.id);
          const n = posts.filter((p) => p.landmark_id === s.id).length;
          return (
            <li key={s.id} className="flex items-center gap-3 border-b border-uw-mist py-3">
              <button
                onClick={() => toggleVisited(s.id)}
                aria-pressed={visited}
                aria-label={`${visited ? "Unmark" : "Mark"} ${s.name} as visited`}
                className={cn("press tabular grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold", visited ? "bg-uw-green text-uw-on-accent" : s.id === nextStop?.id ? "bg-uw-orange text-uw-on-accent" : "bg-uw-surface")}
              >
                {visited ? <Check className="size-4" /> : s.number}
              </button>
              <Link href={`/landmark/${s.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                <span className="tabular block text-[12px] text-uw-slate">{s.routeKm.toFixed(2)} km · {s.area}{n ? ` · ${n} post${n > 1 ? "s" : ""}` : ""}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {done > 0 && (
        <button onClick={() => confirm("Clear your visited stops for this walk?") && resetProgress()} className="press mt-6 flex items-center gap-2 text-[13px] text-uw-slate">
          <RotateCcw className="size-4" /> Reset progress
        </button>
      )}
    </main>
  );
}
