"use client";

import { AccountButton } from "@/components/uw/account-button";
import { Wordmark } from "@/components/uw/brand";
import { useState } from "react";
import { PenLine } from "lucide-react";
import { PostCard } from "@/components/community/post-card";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { backendMode } from "@/lib/backend";
import { cn } from "@/lib/utils";

type Filter = "all" | "photo" | "observation";

const PAGE = 20;

export default function CommunityPage() {
  const { model } = useEvent();
  const { posts, postsError, openComposer } = useWalk();
  const [filter, setFilter] = useState<Filter>("all");
  const [stopId, setStopId] = useState("");
  // photos load 20 posts at a time, so opening the feed never downloads hundreds of images
  const [limit, setLimit] = useState(PAGE);
  const matching = posts.filter((p) => (filter === "all" || p.kind === filter) && (!stopId || p.landmark_id === stopId));
  const shown = matching.slice(0, limit);

  return (
    <main className="px-content min-h-dvh pb-36 safe-top">
      <div className="flex items-center justify-between pt-4">
        <Wordmark className="w-[118px] text-uw-ink" />
        <AccountButton />
      </div>
      <header className="pt-5">
        <p className="eyebrow text-uw-slate">Shared field notes</p>
        <h1 className="display mt-2 text-[clamp(40px,13vw,72px)]">Discoveries</h1>
        <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed text-uw-charcoal/75">
          What participants noticed, felt and photographed along the walk.
        </p>
      </header>

      <button onClick={() => openComposer("observation", stopId || null)} className="press mt-5 flex w-full items-center gap-3 rounded-[22px] bg-uw-ink p-4 text-left text-uw-paper">
        <span className="grid size-10 place-items-center rounded-full bg-uw-orange text-uw-on-accent"><PenLine className="size-5" /></span>
        <span>
          <span className="block text-[15px] font-semibold">Write an observation</span>
          <span className="block text-[12.5px] text-uw-paper/65">How did this part of the city feel to walk through?</span>
        </span>
      </button>

      <div className="mt-6 flex items-center gap-2">
        {(["all", "photo", "observation"] as Filter[]).map((f) => (
          <button key={f} onClick={() => { setFilter(f); setLimit(PAGE); }} aria-pressed={filter === f} className={cn("press h-9 rounded-full px-3.5 text-[13px] font-medium capitalize", filter === f ? "bg-uw-ink text-uw-paper" : "bg-uw-surface")}>
            {f === "all" ? "All" : `${f}s`}
          </button>
        ))}
        <select value={stopId} onChange={(e) => { setStopId(e.target.value); setLimit(PAGE); }} aria-label="Filter by stop" className="ml-auto h-9 max-w-[130px] rounded-full bg-uw-surface px-3 text-[13px] outline-none">
          <option value="">Every stop</option>
          {model.stops.map((s) => <option key={s.id} value={s.id}>{s.number}. {s.name}</option>)}
        </select>
      </div>

      {postsError && <p role="alert" className="mt-4 rounded-[18px] bg-red-50 p-3 text-[13px] text-red-700">{postsError}</p>}

      <div className="mt-4 grid items-start gap-3 md:grid-cols-2">
        {shown.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-uw-line p-6 text-center text-[14px] text-uw-slate">
            Nothing here yet. Tap the orange camera button or write the first observation.
          </div>
        ) : (
          shown.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>

      {matching.length > shown.length && (
        <button onClick={() => setLimit((n) => n + PAGE)} className="press focus-ring mx-auto mt-5 flex h-11 items-center rounded-full bg-uw-surface px-5 text-[13.5px] font-semibold">
          Show more ({matching.length - shown.length})
        </button>
      )}

      {backendMode === "local" && (
        <p className="mt-6 text-center text-[11.5px] text-uw-slate">Development mode: posts are stored on this device only. Connect Supabase to share them.</p>
      )}
    </main>
  );
}
