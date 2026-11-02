"use client";
/* eslint-disable @next/next/no-img-element -- participant photo thumbnails are local/object URLs */

import { memo, useEffect, useRef } from "react";
import { Bath, Check, Info } from "lucide-react";
import { MapMarker, MarkerContent } from "@/components/ui/map";
import { WikiImage } from "@/components/uw/wiki-image";
import { cn } from "@/lib/utils";
import type { Place, Post, Stop } from "@/lib/types";
import type { ZoomTier } from "./use-zoom-tier";

/**
 * One DOM node per stop whose look changes by zoom tier:
 *   1 far    → small numbered dot
 *   2 medium → compact photo + name
 *   3 close  → large photo bubble with yellow ring, number and name
 * Size changes are transform: scale on a fixed 64px bubble (compositor only).
 */
export const StopMarker = memo(function StopMarker({
  stop, tier, selected, visited, onSelect,
}: { stop: Stop; tier: ZoomTier; selected: boolean; visited: boolean; onSelect: (id: string) => void }) {
  const photo = stop.content?.photos[0];
  const scale = selected ? 1.08 : tier === 3 ? 1 : tier === 2 ? 0.6 : 0.3;
  const showPhoto = tier > 1 || selected;
  // lift the selected stop above its neighbours (marker element is two levels up)
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = btn.current?.parentElement?.parentElement;
    if (el) el.style.zIndex = selected ? "20" : "";
  }, [selected]);
  return (
    <MapMarker longitude={stop.coord[0]} latitude={stop.coord[1]} onClick={() => onSelect(stop.id)}>
      <MarkerContent className="uw-marker">
        <button
          ref={btn}
          aria-label={`Stop ${stop.number}: ${stop.name}`}
          className="relative grid size-16 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uw-ink"
        >
          <span
            className={cn(
              "absolute inset-0 overflow-hidden rounded-full bg-uw-mist shadow-[var(--shadow-float)] transition-[transform,opacity] duration-500 ease-[var(--ease-out-expo)]",
              visited ? "ring-[3px] ring-uw-ink" : "ring-[3px] ring-uw-yellow",
              selected && "ring-4",
              !showPhoto && "opacity-0",
            )}
            style={{ transform: `scale(${scale})` }}
          >
            {photo ? (
              <WikiImage photo={photo} sizes="64px" maxWidth={250} className="size-full" alt="" />
            ) : (
              <span className="grid size-full place-items-center bg-white text-[22px] font-semibold text-uw-ink">{stop.number}</span>
            )}
          </span>
          {/* number badge: the whole marker at tier 1, a corner badge otherwise */}
          <span
            className={cn(
              "tabular absolute grid size-6 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-white transition-transform duration-500 ease-[var(--ease-out-expo)]",
              visited ? "bg-uw-ink text-white" : "bg-uw-yellow text-uw-ink",
            )}
            style={{
              transform: showPhoto
                ? `translate(${22 * scale}px, ${22 * scale}px)`
                : "translate(0,0) scale(0.95)",
            }}
          >
            {visited && !showPhoto ? <Check className="size-3.5" strokeWidth={3} /> : stop.number}
          </span>
        </button>
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 top-full whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-semibold tracking-tight text-uw-ink shadow-sm transition-[opacity,transform] duration-300",
            tier === 1 && !selected ? "opacity-0" : "opacity-100",
          )}
          style={{ transform: `translate(-50%, ${tier === 3 || selected ? 4 : -10}px)` }}
        >
          {stop.name}
        </span>
      </MarkerContent>
    </MapMarker>
  );
});

/** Supporting locations: not stops, so deliberately quieter (slate dot + name up close). */
export const PlaceMarker = memo(function PlaceMarker({ place, tier, onSelect }: { place: Place; tier: ZoomTier; onSelect: (id: string) => void }) {
  if (tier === 1) return null;
  return (
    <MapMarker longitude={place.coord[0]} latitude={place.coord[1]} onClick={() => onSelect(place.id)}>
      <MarkerContent>
        <button aria-label={place.name} className="flex items-center gap-1.5">
          <span className="grid size-5 place-items-center rounded-full bg-uw-slate text-white ring-2 ring-white">
            <Info className="size-3" strokeWidth={2.5} />
          </span>
          {tier === 3 && <span className="rounded-full bg-white/85 px-2 py-0.5 text-[10.5px] font-medium text-uw-charcoal">{place.name}</span>}
        </button>
      </MarkerContent>
    </MapMarker>
  );
});

export const FacilityMarker = memo(function FacilityMarker({ place, tier }: { place: Place; tier: ZoomTier }) {
  if (tier === 1) return null;
  return (
    <MapMarker longitude={place.coord[0]} latitude={place.coord[1]}>
      <MarkerContent>
        <span title={place.name} aria-label={place.name} className="grid size-6 place-items-center rounded-[8px] bg-[#3949ab] text-white ring-2 ring-white">
          <Bath className="size-3.5" />
        </span>
      </MarkerContent>
    </MapMarker>
  );
});

export const PostMarker = memo(function PostMarker({ post, tier, onSelect }: { post: Post; tier: ZoomTier; onSelect: (p: Post) => void }) {
  if (!post.geo || tier === 1) return null;
  return (
    <MapMarker longitude={post.geo.lng} latitude={post.geo.lat} onClick={() => onSelect(post)}>
      <MarkerContent>
        <button aria-label={`Post by ${post.user_name}`} className="block size-8 overflow-hidden rounded-[10px] bg-white shadow-md ring-2 ring-white">
          {post.image_url ? <img src={post.thumb_url ?? post.image_url} alt="" loading="lazy" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[13px]">✎</span>}
        </button>
      </MarkerContent>
    </MapMarker>
  );
});

export function UserMarker({ coord, accuracy, heading }: { coord: [number, number]; accuracy: number; heading: number | null }) {
  return (
    <MapMarker longitude={coord[0]} latitude={coord[1]} className="z-30">
      <MarkerContent>
        <span className="relative grid size-5 place-items-center" aria-label={`Your location, accuracy ${Math.round(accuracy)} metres`}>
          <span className="absolute size-10 animate-ping rounded-full bg-uw-ink/15 motion-reduce:hidden" />
          {heading !== null && (
            <span className="absolute -top-2.5 h-0 w-0 border-x-[6px] border-b-[9px] border-x-transparent border-b-uw-ink" style={{ transform: `rotate(${heading}deg)`, transformOrigin: "50% 160%" }} />
          )}
          <span className="size-5 rounded-full border-[3px] border-white bg-uw-ink shadow-md" />
        </span>
      </MarkerContent>
    </MapMarker>
  );
}
