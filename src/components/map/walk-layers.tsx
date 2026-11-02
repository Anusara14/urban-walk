"use client";

import { useEffect } from "react";
import type * as GeoJSON from "geojson";
import type { ExpressionSpecification, Map as MLMap } from "maplibre-gl";
import { useMap } from "@/components/ui/map";
import type { WalkModel } from "@/lib/event-model";
import { BUILDING_LAYER, COLORS, MIN_3D_ZOOM, VECTOR_SOURCE } from "./config";

const ids = {
  corridor: "uw-corridor",
  rest: "uw-rest-areas",
  restLine: "uw-rest-areas-line",
  buildings3d: "uw-buildings-3d",
};

/** Quiet, architectural basemap: grey ground, pale water, white roads, muted labels. */
function tuneBasemap(map: MLMap) {
  const set = (layer: string, prop: Parameters<MLMap["setPaintProperty"]>[1], value: string) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };
  set("background", "background-color", COLORS.background);
  set("water", "fill-color", COLORS.water);
  set("park", "fill-color", COLORS.park);
  set("building", "fill-color", COLORS.building2d);
  for (const l of map.getStyle().layers) {
    if (l.type === "line" && /^highway_(minor|major_inner|motorway_inner|path)/.test(l.id)) set(l.id, "line-color", COLORS.road);
    if (l.type === "symbol" && l.id.startsWith("label_")) set(l.id, "text-color", COLORS.label);
  }
}

/**
 * Hybrid 2D/3D. Buildings stay flat everywhere (basemap layer); a second
 * fill-extrusion layer only keeps buildings within `corridor_m` of the route,
 * evaluated per feature in the tile worker via the `distance` expression —
 * so nothing outside the walking corridor is ever extruded.
 */
export function WalkLayers({ model, show3d }: { model: WalkModel; show3d: boolean }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    tuneBasemap(map);

    const routeGeom: GeoJSON.LineString = { type: "LineString", coordinates: model.line };
    const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;

    map.addSource(ids.corridor, { type: "geojson", data: model.corridor });
    map.addLayer(
      { id: ids.corridor, type: "fill", source: ids.corridor, paint: { "fill-color": "#ffffff", "fill-opacity": 0.42 } },
      "building",
    );

    map.addSource(ids.rest, { type: "geojson", data: model.restAreas });
    map.addLayer({ id: ids.rest, type: "fill", source: ids.rest, paint: { "fill-color": "#b8d4b0", "fill-opacity": 0.55 } }, firstLabel);
    map.addLayer({ id: ids.restLine, type: "line", source: ids.rest, paint: { "line-color": "#7fa877", "line-width": 1.2 } }, firstLabel);

    const nearRoute: ExpressionSpecification = ["<=", ["distance", routeGeom], model.event.corridor_m];
    map.addLayer(
      {
        id: ids.buildings3d,
        type: "fill-extrusion",
        source: VECTOR_SOURCE,
        "source-layer": BUILDING_LAYER,
        minzoom: MIN_3D_ZOOM,
        filter: ["all", ["!=", ["get", "hide_3d"], true], nearRoute],
        layout: { visibility: show3d ? "visible" : "none" },
        paint: {
          "fill-extrusion-color": COLORS.building3d,
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], MIN_3D_ZOOM, 0, MIN_3D_ZOOM + 0.6, ["coalesce", ["get", "render_height"], 6]],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstLabel,
    );

    return () => {
      for (const l of [ids.buildings3d, ids.restLine, ids.rest, ids.corridor]) if (map.getLayer(l)) map.removeLayer(l);
      for (const s of [ids.rest, ids.corridor]) if (map.getSource(s)) map.removeSource(s);
    };
  }, [map, isLoaded, model]);

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(ids.buildings3d)) return;
    map.setLayoutProperty(ids.buildings3d, "visibility", show3d ? "visible" : "none");
  }, [map, isLoaded, show3d]);

  return null;
}
