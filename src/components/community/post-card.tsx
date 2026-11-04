"use client";
/* eslint-disable @next/next/no-img-element -- participant photos are object/storage URLs */

import { useState } from "react";
import Link from "next/link";
import { Heart, MapPin, MessageCircle, Send, Trash2 } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { useAuth } from "@/lib/auth";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export function PostCard({ post, compact }: { post: Post; compact?: boolean }) {
  const { model } = useEvent();
  const { like, comment, removePost } = useWalk();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stop = model.stops.find((s) => s.id === post.landmark_id);
  const { account } = useAuth();
  // own posts, or any post for organisers (moderation; enforced by RLS too)
  const canDelete = !!account && (post.user_id === account.id || account.organiser);

  const attempt = async (fn: () => Promise<void>) => {
    try {
      await fn();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work, try again.");
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await comment(post.id, text.slice(0, 1000));
      setDraft("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comment failed");
    }
  };

  return (
    <article id={post.id} className="overflow-hidden rounded-[24px] bg-uw-surface">
      {post.image_url && !compact && (
        // thumbnail in the feed; the full photo only loads if someone taps it
        <a href={post.image_url} target="_blank" rel="noreferrer" aria-label="Open full photo">
          <img src={post.thumb_url ?? post.image_url} alt={post.text || "Participant photo"} loading="lazy" decoding="async" className="max-h-[420px] w-full object-cover" />
        </a>
      )}
      <div className="p-4">
        <header className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-uw-mist text-[13px] font-semibold">{post.user_name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13.5px] font-semibold">{post.user_name}</p>
            <p className="text-[11.5px] text-uw-slate">{ago(post.created_at)} · {post.kind === "photo" ? "Photo" : "Observation"}</p>
          </div>
          {canDelete && (
            <button onClick={() => confirm("Delete this post?") && attempt(() => removePost(post.id))} aria-label="Delete post" className="press grid size-8 place-items-center rounded-full text-uw-slate">
              <Trash2 className="size-4" />
            </button>
          )}
        </header>

        {post.prompt && <p className="mt-3 text-[12px] font-medium text-uw-slate">“{post.prompt}”</p>}
        {post.text && <p className={cn("whitespace-pre-line text-[15px] leading-relaxed", post.prompt ? "mt-1" : "mt-3")}>{post.text}</p>}
        {post.image_url && compact && <img src={post.thumb_url ?? post.image_url} alt="" loading="lazy" className="mt-3 h-40 w-full rounded-[16px] object-cover" />}

        <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
          {stop && (
            <Link href={`/landmark/${stop.id}`} className="rounded-full bg-uw-orange px-2.5 py-1 font-semibold text-uw-on-accent">{String(stop.number).padStart(2, "0")} · {stop.name}</Link>
          )}
          {post.geo && (
            <Link href={`/walk`} className="flex items-center gap-1 rounded-full bg-uw-mist px-2.5 py-1 text-uw-charcoal">
              <MapPin className="size-3" /> On the map
            </Link>
          )}
        </div>

        <footer className="mt-3 flex items-center gap-1 border-t border-uw-mist pt-2">
          <button onClick={() => attempt(() => like(post.id))} aria-pressed={post.liked_by_me} className={cn("press flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px]", post.liked_by_me && "text-[#c2410c]")}>
            <Heart className={cn("size-4", post.liked_by_me && "fill-current")} /> {post.likes > 0 ? post.likes : "Appreciate"}
          </button>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="press flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px]">
            <MessageCircle className="size-4" /> {post.comments.length || "Comment"}
          </button>
        </footer>

        {error && !open && <p role="alert" className="mt-1 text-[12px] text-red-700">{error}</p>}
        {open && (
          <div className="mt-2">
            <ul className="flex flex-col gap-2">
              {post.comments.map((c) => (
                <li key={c.id} className="rounded-[14px] bg-uw-paper px-3 py-2 text-[13.5px]">
                  <span className="font-semibold">{c.user_name}</span> {c.content}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                maxLength={1000}
                placeholder="Add to the discussion…"
                aria-label="Comment"
                className="h-10 flex-1 rounded-full border border-uw-line bg-uw-surface px-4 text-[13.5px] outline-none focus:border-uw-ink"
              />
              <button onClick={send} disabled={!draft.trim()} aria-label="Send comment" className="press grid size-10 place-items-center rounded-full bg-uw-ink text-uw-paper disabled:opacity-30">
                <Send className="size-4" />
              </button>
            </div>
            {error && <p role="alert" className="mt-1 text-[12px] text-red-700">{error}</p>}
          </div>
        )}
      </div>
    </article>
  );
}
