"use client";
/* eslint-disable @next/next/no-img-element -- participant thumbnails are storage/object URLs */

import { useState } from "react";
import { ExternalLink, Heart, MessageCircle, PenLine, Search, Trash2 } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

type Kind = "all" | Post["kind"];

/** Every participant post, newest first, with delete. Organisers' deletes are allowed by RLS. */
export function Moderation() {
  const { model } = useEvent();
  const { posts, removePost } = useWalk();
  const [kind, setKind] = useState<Kind>("all");
  const [stopId, setStopId] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const shown = posts.filter(
    (p) =>
      (kind === "all" || p.kind === kind) &&
      (!stopId || p.landmark_id === stopId) &&
      (!needle || p.text.toLowerCase().includes(needle) || p.user_name.toLowerCase().includes(needle)),
  );

  const remove = async (p: Post) => {
    if (!confirm(`Delete this ${p.kind} by ${p.user_name}? Its photo and comments are removed too.`)) return;
    try {
      await removePost(p.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const stopName = (id: string | null) => {
    const s = model.stops.find((x) => x.id === id);
    return s ? `${s.number}. ${s.name}` : "—";
  };

  return (
    <div className="grid gap-4">
      {/* filters, one row (wraps on phones) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-white p-1 shadow-sm">
          {(["all", "photo", "observation"] as Kind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={cn("h-8 rounded-full px-3 text-[12.5px] font-medium capitalize", kind === k && "bg-uw-ink text-white")}>
              {k === "all" ? "All" : `${k}s`}
            </button>
          ))}
        </div>
        <select value={stopId} onChange={(e) => setStopId(e.target.value)} aria-label="Filter by stop" className="h-10 rounded-full bg-white px-3.5 text-[13px] shadow-sm outline-none">
          <option value="">Every stop</option>
          {model.stops.map((s) => <option key={s.id} value={s.id}>{s.number}. {s.name}</option>)}
        </select>
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-uw-slate" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text or name" aria-label="Search posts" className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[13px] shadow-sm outline-none focus:ring-2 focus:ring-uw-ink" />
        </label>
        <span className="tabular text-[12.5px] text-uw-slate">{shown.length} of {posts.length}</span>
      </div>
      {error && <p role="alert" className="rounded-[16px] bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}

      {shown.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-uw-line p-6 text-center text-[13.5px] text-uw-slate">Nothing matches.</p>
      ) : (
        <>
          {/* desktop: table */}
          <div className="hidden overflow-hidden rounded-[20px] bg-white md:block">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-uw-mist/60 text-[11px] uppercase tracking-wider text-uw-slate">
                <tr>
                  <th className="p-3 font-semibold">Post</th>
                  <th className="p-3 font-semibold">By</th>
                  <th className="p-3 font-semibold">Stop</th>
                  <th className="p-3 font-semibold">When</th>
                  <th className="p-3 text-right font-semibold">Activity</th>
                  <th className="w-12 p-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="border-t border-uw-mist align-middle hover:bg-uw-paper/60">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Thumb post={p} />
                        <span className="line-clamp-2 max-w-[28rem]">{p.text || <em className="text-uw-slate">No caption</em>}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-3">{p.user_name}</td>
                    <td className="whitespace-nowrap p-3 text-uw-slate">{stopName(p.landmark_id)}</td>
                    <td className="tabular whitespace-nowrap p-3 text-uw-slate">{fmtWhen(p.created_at)}</td>
                    <td className="tabular whitespace-nowrap p-3 text-right text-uw-slate">
                      <span className="inline-flex items-center gap-1"><Heart className="size-3.5" />{p.likes}</span>
                      <span className="ml-3 inline-flex items-center gap-1"><MessageCircle className="size-3.5" />{p.comments.length}</span>
                    </td>
                    <td className="p-2"><DeleteButton onClick={() => remove(p)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phone: cards */}
          <ul className="grid gap-2.5 md:hidden">
            {shown.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-[20px] bg-white p-3">
                <Thumb post={p} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-[14px]">{p.text || <em className="text-uw-slate">No caption</em>}</p>
                  <p className="mt-1 truncate text-[12px] text-uw-slate">{p.user_name} · {stopName(p.landmark_id)}</p>
                  <p className="tabular mt-0.5 text-[12px] text-uw-slate">{fmtWhen(p.created_at)} · {p.likes} ♥ · {p.comments.length} comments</p>
                </div>
                <DeleteButton onClick={() => remove(p)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Thumb({ post }: { post: Post }) {
  if (!post.image_url) return <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-uw-mist"><PenLine className="size-4 text-uw-slate" /></span>;
  return (
    <a href={post.image_url} target="_blank" rel="noreferrer" className="relative block size-12 shrink-0 overflow-hidden rounded-[12px]" aria-label="Open full photo">
      <img src={post.thumb_url ?? post.image_url} alt="" loading="lazy" className="size-full object-cover" />
      <ExternalLink className="absolute bottom-0.5 right-0.5 size-3 text-white drop-shadow" />
    </a>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Delete post" className="press grid size-9 shrink-0 place-items-center rounded-full text-uw-slate hover:bg-red-50 hover:text-red-700">
      <Trash2 className="size-4" />
    </button>
  );
}

const fmtWhen = (iso: string) => new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
