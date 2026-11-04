"use client";
/* eslint-disable @next/next/no-img-element -- participant photos are object/storage URLs */

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight, Check, Heart, MessageCircle, X } from "lucide-react";
import { useWalk } from "@/components/providers/walk-provider";
import { useEvent } from "@/components/providers/event-provider";
import { StopBadge } from "@/components/uw/stop-badge";
import { WikiImage } from "@/components/uw/wiki-image";
import { CATEGORY_LABEL } from "@/lib/event-model";
import { fmtDistance } from "@/lib/geo";
import type { Place, Post, Stop } from "@/lib/types";
import { cn } from "@/lib/utils";
import { settleAfter } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

function FloatingCard({ children, onClose, k }: { children: ReactNode; onClose: () => void; k: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    return settleAfter(gsap.fromTo(ref.current, { y: 40, autoAlpha: 0, scale: 0.97 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.55, ease: "expo.out" }));
  }, { dependencies: [k] });
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),14px)+80px)] z-30 flex justify-center px-3">
      <div ref={ref} className="glass-strong pointer-events-auto relative w-full max-w-[416px] rounded-[28px] p-2.5">
        <button onClick={onClose} aria-label="Close preview" className="press absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-uw-surface/70">
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function StopPreview({ stop, onClose }: { stop: Stop; onClose: () => void }) {
  const { distanceTo, progress, toggleVisited } = useWalk();
  const photo = stop.content?.photos[0];
  const d = distanceTo(stop.coord);
  const visited = progress.visited.includes(stop.id);
  return (
    <FloatingCard onClose={onClose} k={stop.id}>
      <div className="flex gap-3">
        <Link href={`/landmark/${stop.id}`} className="relative block h-[118px] w-[104px] shrink-0 overflow-hidden rounded-[20px] bg-uw-mist">
          {photo && <WikiImage photo={photo} sizes="104px" maxWidth={250} className="size-full" alt="" />}
          <StopBadge n={stop.number} visited={visited} className="absolute left-1.5 top-1.5" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col py-1">
          <p className="eyebrow tabular pr-8 text-uw-slate">
            {d !== null ? `${fmtDistance(d)} away` : `${stop.routeKm.toFixed(1)} km along route`} · {stop.area}
          </p>
          <h3 className="mt-1 pr-6 text-[19px] font-semibold leading-tight tracking-tight">{stop.name}</h3>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-uw-charcoal/80">
            {stop.short || "Organisers’ notes for this stop are still being verified."}
          </p>
          <div className="mt-auto flex gap-2 pt-2">
            <Link href={`/landmark/${stop.id}`} className="press flex h-9 items-center gap-1 whitespace-nowrap rounded-full bg-uw-orange px-3.5 text-[12.5px] font-semibold text-uw-on-accent">
              View details <ArrowUpRight className="size-3.5" />
            </Link>
            <button
              onClick={() => toggleVisited(stop.id)}
              aria-pressed={visited}
              className={cn("press flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium", visited ? "bg-uw-ink text-uw-paper" : "bg-uw-surface/80")}
            >
              <Check className="size-3.5" /> Visited
            </button>
          </div>
        </div>
      </div>
    </FloatingCard>
  );
}

export function PlacePreview({ place, onClose }: { place: Place; onClose: () => void }) {
  const { distanceTo } = useWalk();
  const photo = place.content?.photos[0];
  const text = place.content?.article?.paragraphs[0];
  const d = distanceTo(place.coord);
  return (
    <FloatingCard onClose={onClose} k={place.id}>
      <div className="flex gap-3">
        <div className="h-[96px] w-[88px] shrink-0 overflow-hidden rounded-[18px] bg-uw-mist">
          {photo && <WikiImage photo={photo} sizes="88px" maxWidth={250} className="size-full" alt="" />}
        </div>
        <div className="min-w-0 flex-1 py-1">
          <p className="eyebrow pr-8 text-uw-slate">{CATEGORY_LABEL[place.category]}{d !== null ? ` · ${fmtDistance(d)}` : ""}</p>
          <h3 className="mt-1 text-[16px] font-semibold leading-tight">{place.name}</h3>
          {text && <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-uw-charcoal/80">{text}</p>}
          {place.content?.article && (
            <a href={place.content.article.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-uw-slate underline">
              Source: Wikipedia
            </a>
          )}
        </div>
      </div>
    </FloatingCard>
  );
}

export function PostPreview({ post, onClose }: { post: Post; onClose: () => void }) {
  const { model } = useEvent();
  const stop = model.stops.find((s) => s.id === post.landmark_id);
  return (
    <FloatingCard onClose={onClose} k={post.id}>
      <div className="flex gap-3">
        {post.image_url && <img src={post.thumb_url ?? post.image_url} alt="" className="h-[96px] w-[88px] shrink-0 rounded-[18px] object-cover" />}
        <div className="min-w-0 flex-1 py-1">
          <p className="eyebrow pr-8 text-uw-slate">{post.user_name}{stop ? ` · ${stop.name}` : ""}</p>
          <p className="mt-1 line-clamp-3 text-[13px] leading-snug">{post.text || "—"}</p>
          <Link href={`/community#${post.id}`} className="mt-2 flex items-center gap-3 text-[12px] text-uw-slate">
            <span className="flex items-center gap-1"><Heart className="size-3.5" />{post.likes}</span>
            <span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{post.comments.length}</span>
            <span className="underline">Open in Discoveries</span>
          </Link>
        </div>
      </div>
    </FloatingCard>
  );
}
