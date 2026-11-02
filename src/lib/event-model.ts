import type * as GeoJSON from "geojson";
import { cumulative, haversineM, projectOnLine, sliceLine } from "./geo";
import type { BaseData, Category, EventConfig, LngLat, Place, SegmentConfig, Stop } from "./types";

const DUPLICATE_M = 60;

export type WalkModel = {
  event: EventConfig;
  line: LngLat[];
  cum: number[];
  lengthM: number;
  stops: Stop[];
  places: Place[];
  facilities: Place[];
  restAreas: GeoJSON.FeatureCollection;
  corridor: GeoJSON.FeatureCollection;
  segments: (SegmentConfig & { line: LngLat[] })[];
  walkMinutes: number;
  totalMinutes: number;
};

/** First sentence(s) of the sourced intro, capped for preview cards. */
function shortFrom(text?: string) {
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > 170 && out) break;
    out += s;
  }
  return out.trim();
}

export function buildModel(base: BaseData, override?: Partial<EventConfig>): WalkModel {
  const event = { ...base.event, ...override };
  const line = (base.route.features[0].geometry as GeoJSON.LineString).coordinates as LngLat[];
  const cum = cumulative(line);
  const lengthM = cum[cum.length - 1];
  const byId = new Map(base.landmarks.features.map((f) => [f.properties.id, f]));
  const categoryOf = (id: string, fallback: Category) => event.category_overrides[id] ?? fallback;

  const stops: Stop[] = event.stops
    .map((s) => ({ s, f: byId.get(s.feature_id) }))
    .filter((x) => x.f && categoryOf(x.s.feature_id, x.f.properties.category) !== "supporting_location")
    .map(({ s, f }) => {
      const coord = (f!.geometry as GeoJSON.Point).coordinates as LngLat;
      const proj = projectOnLine(line, cum, coord);
      const content = base.content[s.feature_id] ?? null;
      return {
        id: s.feature_id,
        number: 0,
        name: s.display_name,
        sourceName: f!.properties.name,
        area: s.area ?? "",
        coord,
        routeKm: proj.alongM / 1000,
        offsetM: proj.distM,
        radiusM: s.proximity_m ?? event.default_proximity_m,
        role: s.role,
        short: shortFrom(content?.article?.paragraphs[0]),
        content,
        sections: event.sections[s.feature_id] ?? [],
      };
    })
    // order follows the route, not the config list
    .sort((a, b) => a.routeKm - b.routeKm)
    .map((s, i) => ({ ...s, number: i + 1 }));

  const stopIds = new Set(stops.map((s) => s.id));
  const toPlace = (f: BaseData["landmarks"]["features"][number]): Place => ({
    id: f.properties.id,
    name: f.properties.name,
    coord: (f.geometry as GeoJSON.Point).coordinates as LngLat,
    category: categoryOf(f.properties.id, f.properties.category),
    routeKm: f.properties.route_position_km ?? 0,
    content: base.content[f.properties.id] ?? null,
  });
  const places = base.landmarks.features
    .filter((f) => !stopIds.has(f.properties.id))
    .map(toPlace)
    // start/end markers coincide with stop 1 / last stop
    .filter((p) => p.category !== "starting_point" && p.category !== "ending_point")
    // the locations folder repeats most stops a few metres away (see validation report); keep them in data, not on the map
    .filter((p) => !stops.some((s) => haversineM(s.coord, p.coord) <= DUPLICATE_M));

  const segments = event.segments
    .filter((s) => s.end_km > s.start_km)
    .map((s) => ({ ...s, line: sliceLine(line, cum, s.start_km * 1000, Math.min(lengthM, s.end_km * 1000)) }));

  const walkMinutes = (lengthM / 1000 / event.walking_speed_kmh) * 60;
  return {
    event,
    line,
    cum,
    lengthM,
    stops,
    places,
    facilities: base.facilities.features.map(toPlace),
    restAreas: base.restAreas,
    corridor: base.corridor,
    segments,
    walkMinutes,
    totalMinutes: walkMinutes + stops.length * event.dwell_minutes_per_stop,
  };
}

export const CATEGORY_LABEL: Record<Category, string> = {
  official_landmark: "Official landmark",
  supporting_location: "Supporting location",
  rest_area: "Rest area",
  public_facility: "Public facility",
  starting_point: "Starting point",
  ending_point: "Ending point",
  route: "Route",
};
