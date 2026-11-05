"use client";

import { forwardRef, useMemo } from "react";
import { Map, MapMarker, MapRoute, MarkerContent, type MapRef } from "@/components/ui/map";
import type { WalkModel } from "@/lib/event-model";
import { bounds, fmtMinutes, sliceLine } from "@/lib/geo";
import type { LngLat, Post } from "@/lib/types";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BASEMAP_STYLE, BASEMAP_STYLE_DARK, MAP_COLORS, PITCH_3D, type MapColors } from "./config";
import { FacilityMarker, PlaceMarker, PostMarker, StopMarker, UserMarker } from "./markers";
import { useZoomTier } from "./use-zoom-tier";
import { WalkLayers } from "./walk-layers";

const MAP_POSTS = 60;
export const ROUTE_PADDING = { top: 190, bottom: 210, left: 36, right: 76 };
const STYLES = { light: BASEMAP_STYLE, dark: BASEMAP_STYLE_DARK };

type Props = {
  model: WalkModel;
  show3d: boolean;
  selectedId: string | null;
  visited: string[];
  fraction: number;
  user: { coord: LngLat; accuracy: number; heading: number | null } | null;
  posts: Post[];
  segmentId: string | null;
  etaLabel: { at: LngLat; minutes: number } | null;
  onSelect: (id: string | null) => void;
  onSelectPost: (p: Post) => void;
};

export const WalkMap = forwardRef<MapRef, Props>(function WalkMap(props, ref) {
  const { model, show3d } = props;
  const initialBounds = useMemo(() => bounds(model.line), [model.line]);
  const scheme = useColorScheme();
  const colors = MAP_COLORS[scheme];
  return (
    // ponytail: remount on a light/dark switch (rare) instead of re-adding layers after a style swap
    <Map
      key={scheme}
      ref={ref}
      theme={scheme}
      styles={STYLES}
      bounds={initialBounds}
      fitBoundsOptions={{ padding: ROUTE_PADDING }}
      pitch={show3d ? PITCH_3D : 0}
      maxPitch={70}
      minZoom={11}
      dragRotate
      className="isolate bg-uw-paper"
    >
      <WalkLayers model={model} show3d={show3d} colors={colors} />
      <MapContents {...props} colors={colors} />
    </Map>
  );
});

function MapContents({ model, selectedId, visited, fraction, user, posts, segmentId, etaLabel, onSelect, onSelectPost, colors: c }: Props & { colors: MapColors }) {
  const tier = useZoomTier();
  const segment = model.segments.find((s) => s.id === segmentId);
  const visitedSet = useMemo(() => new Set(visited), [visited]);
  const upcoming = useMemo(
    () => (segment ? null : sliceLine(model.line, model.cum, fraction * model.lengthM, model.lengthM)),
    [segment, model, fraction],
  );

  return (
    <>
      {/* casing keeps the blue legible over any tile colour */}
      <MapRoute id="casing" coordinates={model.line} color={c.casing} width={11} opacity={1} interactive={false} />
      <MapRoute id="walked" coordinates={model.line} color={c.ink} width={4} opacity={0.55} dashArray={[1.2, 1.6]} interactive={false} />
      {upcoming && <MapRoute id="upcoming" coordinates={upcoming} color={c.blue} width={6} opacity={1} interactive={false} />}
      {segment && (
        <MapRoute id="segment" coordinates={segment.line} color={c.blue} width={7} opacity={1} interactive={false} />
      )}

      {etaLabel && tier > 1 && (
        <MapMarker longitude={etaLabel.at[0]} latitude={etaLabel.at[1]}>
          <MarkerContent>
            <span className="glass tabular rounded-full px-3 py-1 text-[12.5px] font-semibold text-uw-ink">{fmtMinutes(etaLabel.minutes)}</span>
          </MarkerContent>
        </MapMarker>
      )}

      {model.facilities.map((f) => <FacilityMarker key={f.id} place={f} tier={tier} />)}
      {model.places.map((p) => <PlaceMarker key={p.id} place={p} tier={tier} onSelect={onSelect} />)}
      {/* newest 60 only: every pin downloads a preview photo, and the feed shows the rest */}
      {posts.slice(0, MAP_POSTS).map((p) => <PostMarker key={p.id} post={p} tier={tier} onSelect={onSelectPost} />)}
      {model.stops.map((s) => (
        <StopMarker key={s.id} stop={s} tier={tier} selected={s.id === selectedId} visited={visitedSet.has(s.id)} onSelect={onSelect} />
      ))}
      {user && <UserMarker coord={user.coord} accuracy={user.accuracy} heading={user.heading} />}
    </>
  );
}
