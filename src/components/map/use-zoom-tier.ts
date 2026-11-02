"use client";

import { useEffect, useState } from "react";
import { useMap } from "@/components/ui/map";
import { ZOOM_TIERS } from "./config";

export type ZoomTier = 1 | 2 | 3;
const tierOf = (z: number): ZoomTier => (z >= ZOOM_TIERS.close ? 3 : z >= ZOOM_TIERS.mid ? 2 : 1);

/** Re-renders only when the tier changes, not on every zoom frame. */
export function useZoomTier(): ZoomTier {
  const { map } = useMap();
  const [tier, setTier] = useState<ZoomTier>(() => (map ? tierOf(map.getZoom()) : 1));
  useEffect(() => {
    if (!map) return;
    const onZoom = () => setTier((t) => {
      const next = tierOf(map.getZoom());
      return next === t ? t : next;
    });
    onZoom();
    map.on("zoom", onZoom);
    return () => {
      map.off("zoom", onZoom);
    };
  }, [map]);
  return tier;
}
