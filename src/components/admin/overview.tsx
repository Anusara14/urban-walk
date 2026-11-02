"use client";
/* eslint-disable @next/next/no-img-element -- participant thumbnails are storage/object URLs */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Footprints, Flag, Heart, MessageCircle, PenLine, RefreshCw, Users } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { backend, backendMode } from "@/lib/backend";
import type { ProgressRow, Stop } from "@/lib/types";
import { cn } from "@/lib/utils";

const REFRESH_MS = 60_000;

/** Organiser overview: who is walking, how far, and what they're contributing. */
export function Overview({ onOpenModeration }: { onOpenModeration: () => void }) {
  const { model } = useEvent();
  const { posts, reloadPosts } = useWalk();
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [rows] = await Promise.all([backend.listProgress(model.event.id), reloadPosts()]);
      setProgress(rows);
      setError(null);
      setUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load live data");
    } finally {
      setBusy(false);
    }
  }, [model.event.id, reloadPosts]);

  // live-ish: refresh every minute while the tab is visible
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load; state is set after the await
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo(() => {
    const walkers = progress.filter((p) => p.started_at).length;
    const finished = progress.filter((p) => p.completed_at).length;
    const avgStops = walkers ? progress.reduce((n, p) => n + p.completed_landmarks.length, 0) / walkers : 0;
    const contributors = new Set(posts.map((p) => p.user_id)).size;
    return {
      walkers, finished, avgStops, contributors,
      photos: posts.filter((p) => p.kind === "photo").length,
      observations: posts.filter((p) => p.kind === "observation").length,
      comments: posts.reduce((n, p) => n + p.comments.length, 0),
      likes: posts.reduce((n, p) => n + p.likes, 0),
    };
  }, [progress, posts]);

  const visitsByStop = model.stops.map((s) => ({ stop: s, value: progress.filter((p) => p.completed_landmarks.includes(s.id)).length }));
  const postsByStop = model.stops.map((s) => ({ stop: s, value: posts.filter((p) => p.landmark_id === s.id).length }));
  const unlinked = posts.filter((p) => !p.landmark_id).length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-uw-slate">
          {backendMode === "local"
            ? "Development mode: figures show this device only. Connect Supabase for everyone's data."
            : updated ? `Updated ${updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · refreshes every minute` : "Loading live data…"}
        </p>
        <button onClick={load} disabled={busy} className="press flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[13px] font-medium shadow-sm disabled:opacity-60">
          <RefreshCw className={cn("size-4", busy && "animate-spin")} /> Refresh
        </button>
      </div>
      {error && <p role="alert" className="rounded-[16px] bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}

      {/* headline numbers are stat tiles, not charts */}
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <Tile icon={Users} label="Walking" value={stats.walkers} hint="started the walk" accent />
        <Tile icon={Flag} label="Finished" value={stats.finished} hint={stats.walkers ? `${Math.round((stats.finished / stats.walkers) * 100)}% of walkers` : "—"} />
        <Tile icon={Footprints} label="Avg stops" value={stats.avgStops.toFixed(1)} hint={`of ${model.stops.length}`} />
        <Tile icon={Camera} label="Photos" value={stats.photos} hint={`${stats.contributors} contributors`} />
        <Tile icon={PenLine} label="Observations" value={stats.observations} hint={`${unlinked} not linked to a stop`} />
        <Tile icon={MessageCircle} label="Discussion" value={stats.comments} hint={`${stats.likes} appreciations`} />
      </dl>

      <div className="grid gap-5 xl:grid-cols-2">
        <StopBars title="Visits by stop" unit="participants" rows={visitsByStop} total={stats.walkers} />
        <StopBars title="Posts by stop" unit="posts" rows={postsByStop} total={posts.length} />
      </div>

      <section className="rounded-[24px] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-tight">Latest posts</h2>
          <button onClick={onOpenModeration} className="text-[13px] font-medium underline underline-offset-2">Moderate all</button>
        </div>
        {posts.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-uw-slate">No posts yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-uw-mist">
            {posts.slice(0, 6).map((p) => {
              const stop = model.stops.find((s) => s.id === p.landmark_id);
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  {p.image_url ? (
                    <img src={p.thumb_url ?? p.image_url} alt="" loading="lazy" className="size-11 shrink-0 rounded-[12px] object-cover" />
                  ) : (
                    <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-uw-mist"><PenLine className="size-4 text-uw-slate" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{p.text || (p.kind === "photo" ? "Photo" : "—")}</p>
                    <p className="truncate text-[12px] text-uw-slate">{p.user_name}{stop ? ` · ${stop.number}. ${stop.name}` : ""}</p>
                  </div>
                  <span className="tabular flex shrink-0 items-center gap-2.5 text-[12px] text-uw-slate">
                    <span className="flex items-center gap-1"><Heart className="size-3.5" />{p.likes}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{p.comments.length}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint, accent }: { icon: typeof Users; label: string; value: number | string; hint: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-[20px] p-4", accent ? "bg-uw-ink text-white" : "bg-white")}>
      <dt className={cn("flex items-center gap-1.5 text-[12px] font-medium", accent ? "text-white/70" : "text-uw-slate")}>
        <Icon className="size-3.5" /> {label}
      </dt>
      <dd className="tabular mt-2 text-[30px] font-semibold leading-none tracking-tight">{value}</dd>
      <dd className={cn("mt-1.5 truncate text-[11.5px]", accent ? "text-white/60" : "text-uw-slate")}>{hint}</dd>
    </div>
  );
}

/**
 * Single-series horizontal bars, one per stop in route order. One hue (ink) on a
 * mist track; the value is printed beside each bar, so the list is its own table.
 */
function StopBars({ title, unit, rows, total }: { title: string; unit: string; rows: { stop: Stop; value: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-[24px] bg-white p-5" aria-label={title}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
        <span className="text-[12px] text-uw-slate">{unit}</span>
      </div>
      <ol className="mt-4 grid gap-1">
        {rows.map(({ stop, value }) => (
          <li
            key={stop.id}
            title={`${stop.number}. ${stop.name}: ${value} ${unit}${total ? ` (${Math.round((value / total) * 100)}%)` : ""}`}
            className="group grid grid-cols-[minmax(0,9.5rem)_1fr_2.25rem] items-center gap-3 rounded-[10px] px-1.5 py-1.5 hover:bg-uw-paper sm:grid-cols-[minmax(0,12rem)_1fr_2.5rem]"
          >
            <span className="flex min-w-0 items-center gap-2 text-[13px]">
              <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-uw-yellow text-[10px] font-semibold">{stop.number}</span>
              <span className="truncate">{stop.name}</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-uw-mist">
              <span
                className="block h-full rounded-full bg-uw-ink transition-[width] duration-500 group-hover:bg-uw-charcoal"
                style={{ width: `${(value / max) * 100}%`, minWidth: value ? 4 : 0 }}
              />
            </span>
            <span className="tabular text-right text-[13px] font-semibold">{value}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
