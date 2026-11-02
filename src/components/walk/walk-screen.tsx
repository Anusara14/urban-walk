"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, ChevronLeft, List, LocateFixed, Maximize2, Minus, Plus, Square } from "lucide-react";
import type { MapRef } from "@/components/ui/map";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { WalkMap, ROUTE_PADDING } from "@/components/map/walk-map";
import { PITCH_3D } from "@/components/map/config";
import { useDeviceTier } from "@/hooks/use-device-tier";
import { bounds, sliceLine } from "@/lib/geo";
import type { LngLat, Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StopPreview, PlacePreview, PostPreview } from "./previews";
import { StopListSheet } from "./stop-list-sheet";
import { TitleBlock } from "./title-block";

export function WalkScreen() {
  const { model } = useEvent();
  const walk = useWalk();
  const { lowPower } = useDeviceTier();
  const router = useRouter();
  const params = useSearchParams();
  const mapRef = useRef<MapRef>(null);

  // null = follow the device default (2D on low-power devices) until the user toggles
  const [manual3d, setManual3d] = useState<boolean | null>(null);
  const show3d = manual3d ?? !lowPower;
  const [selectedId, setSelectedId] = useState<string | null>(params.get("stop"));
  const [post, setPost] = useState<Post | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [segmentId, setSegmentId] = useState<string | null>(null);

  // dev-only handle for debugging the map from the console
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as { __uwMap?: unknown }).__uwMap = () => mapRef.current;
  }, []);

  const selectedStop = model.stops.find((s) => s.id === selectedId) ?? null;
  const selectedPlace = selectedStop ? null : model.places.find((p) => p.id === selectedId) ?? null;
  const focusStop = selectedStop ?? walk.nextStop ?? model.stops[0];

  const flyTo = useCallback(
    (c: LngLat, zoom = 17.2) => {
      const map = mapRef.current;
      if (!map) return;
      map.flyTo({ center: c, zoom: Math.max(map.getZoom(), zoom), pitch: show3d ? PITCH_3D : 0, offset: [0, 40], duration: lowPower ? 0 : 1100, essential: true });
    },
    [show3d, lowPower],
  );

  const select = useCallback(
    (id: string | null) => {
      setPost(null);
      setSelectedId(id);
      const target = id && (model.stops.find((s) => s.id === id) ?? model.places.find((p) => p.id === id));
      if (target) flyTo(target.coord);
    },
    [model, flyTo],
  );

  // Deep-link (?stop=) focus once the map exists.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !selectedStop) return;
    const t = setInterval(() => {
      if (mapRef.current?.loaded()) {
        deepLinked.current = true;
        flyTo(selectedStop.coord);
        clearInterval(t);
      }
    }, 200);
    return () => clearInterval(t);
  }, [selectedStop, flyTo]);

  const overview = useCallback(
    (lineOverride?: LngLat[]) => {
      setSelectedId(null);
      mapRef.current?.fitBounds(bounds(lineOverride ?? model.line), { padding: ROUTE_PADDING, pitch: show3d ? 40 : 0, bearing: 0, duration: lowPower ? 0 : 900 });
    },
    [model.line, show3d, lowPower],
  );

  const toggle3d = () => {
    const next = !show3d;
    setManual3d(next);
    mapRef.current?.easeTo({ pitch: next ? PITCH_3D : 0, duration: lowPower ? 0 : 700 });
  };

  // first fix after pressing locate → centre on it
  const wantedFix = useRef(false);
  const locate = () => {
    if (walk.userCoord) return flyTo(walk.userCoord, 17);
    wantedFix.current = true;
    walk.startLocation();
  };
  useEffect(() => {
    if (walk.geo.status === "active" && wantedFix.current) {
      wantedFix.current = false;
      flyTo([walk.geo.lng, walk.geo.lat], 17);
    }
  }, [walk.geo, flyTo]);

  // "30 min" pill: halfway between where you are on the route and the next stop
  const etaLabel = useMemo(() => {
    const next = walk.nextStop;
    if (!next) return null;
    const fromM = walk.coveredM;
    const toM = next.routeKm * 1000;
    if (toM - fromM < 60) return null;
    const mid = sliceLine(model.line, model.cum, fromM, (fromM + toM) / 2).at(-1)!;
    return { at: mid, minutes: ((toM - fromM) / 1000 / model.event.walking_speed_kmh) * 60 };
  }, [walk.nextStop, walk.coveredM, model]);

  const user = useMemo(
    () => (walk.geo.status === "active" ? { coord: [walk.geo.lng, walk.geo.lat] as LngLat, accuracy: walk.geo.accuracy, heading: walk.geo.heading } : null),
    [walk.geo],
  );
  const selectPost = useCallback((p: Post) => { setSelectedId(null); setPost(p); }, []);
  const visitedCount = walk.progress.visited.length;
  const geoMsg = walk.geo.status === "denied" || walk.geo.status === "error" ? walk.geo.message : walk.geo.status === "unsupported" ? "This browser can't share location. Browse stops from the list." : null;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <WalkMap
        ref={mapRef}
        model={model}
        show3d={show3d}
        selectedId={selectedId}
        visited={walk.progress.visited}
        fraction={walk.fraction}
        user={user}
        posts={walk.posts}
        segmentId={segmentId}
        etaLabel={etaLabel}
        onSelect={select}
        onSelectPost={selectPost}
      />

      {/* soft top fade so the editorial title reads over any part of the map */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-uw-paper via-uw-paper/80 to-transparent" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 safe-top">
        <div className="flex min-w-0 flex-col gap-4">
          <button onClick={() => (history.length > 1 ? router.back() : router.push("/"))} aria-label="Back" className="press focus-ring glass grid size-14 place-items-center rounded-full">
            <ChevronLeft className="size-6" strokeWidth={1.75} />
          </button>
          {focusStop && <TitleBlock stop={focusStop} isNext={!selectedStop} onClick={() => select(focusStop.id)} />}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href="/progress" className="press glass tabular flex h-11 items-center gap-2 rounded-full pl-3 pr-4 text-[12.5px] font-semibold" aria-label="Walking progress">
            <span className="relative size-6">
              <svg viewBox="0 0 36 36" className="size-6 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--uw-line)" strokeWidth="5" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--uw-ink)" strokeWidth="5" strokeDasharray={`${walk.fraction * 94.2} 94.2`} strokeLinecap="round" />
              </svg>
            </span>
            {visitedCount}/{model.stops.length}
          </Link>
          <button onClick={() => setListOpen(true)} className="press glass flex h-11 items-center gap-2 rounded-full px-4 text-[12.5px] font-semibold" aria-label="All stops">
            <List className="size-4" /> Stops
          </button>
        </div>
      </div>

      {/* segment chips (only when organisers have defined segments) */}
      {model.segments.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),14px)+236px)] flex gap-1.5 overflow-x-auto px-4 scrollbar-none">
          {model.segments.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { const next = segmentId === s.id ? null : s.id; setSegmentId(next); overview(next ? s.line : undefined); }}
              className={cn("press shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold", segmentId === s.id ? "bg-uw-ink text-white" : "glass")}
            >
              {String(i + 1).padStart(2, "0")} {s.name}
            </button>
          ))}
        </div>
      )}

      {/* right control rail */}
      <div
        className={cn(
          "absolute bottom-[calc(max(env(safe-area-inset-bottom),14px)+112px)] right-4 flex flex-col items-center gap-2.5 transition-opacity",
          (selectedId || post) && "pointer-events-none opacity-0",
        )}
        inert={!!(selectedId || post)}
      >
        <RailButton label={show3d ? "Switch to 2D" : "Switch to 3D"} onClick={toggle3d}>
          {show3d ? <Square className="size-[18px]" /> : <Box className="size-[18px]" />}
          <span className="sr-only">{show3d ? "2D" : "3D"}</span>
        </RailButton>
        <RailButton label="Route overview" onClick={() => overview(segmentId ? model.segments.find((s) => s.id === segmentId)?.line : undefined)}>
          <Maximize2 className="size-[18px]" />
        </RailButton>
        <RailButton label="My location" onClick={locate} active={walk.geo.status === "active"}>
          <LocateFixed className={cn("size-[18px]", walk.geo.status === "requesting" && "animate-pulse")} />
        </RailButton>
        <div className="glass flex flex-col overflow-hidden rounded-full">
          <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()} className="press grid size-12 place-items-center"><Plus className="size-5" strokeWidth={1.5} /></button>
          <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()} className="press grid size-12 place-items-center"><Minus className="size-5" strokeWidth={1.5} /></button>
        </div>
      </div>

      {geoMsg && !selectedId && !post && (
        <p className="glass absolute bottom-[calc(max(env(safe-area-inset-bottom),14px)+112px)] left-4 right-20 rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug">{geoMsg}</p>
      )}

      {selectedStop && <StopPreview stop={selectedStop} onClose={() => setSelectedId(null)} />}
      {selectedPlace && <PlacePreview place={selectedPlace} onClose={() => setSelectedId(null)} />}
      {post && <PostPreview post={post} onClose={() => setPost(null)} />}

      <StopListSheet open={listOpen} onClose={() => setListOpen(false)} onPick={(id) => { setListOpen(false); select(id); }} />
    </main>
  );
}

function RailButton({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className={cn("press focus-ring grid size-12 place-items-center rounded-full", active ? "bg-uw-ink text-white shadow-[var(--shadow-float)]" : "glass")}>
      {children}
    </button>
  );
}
