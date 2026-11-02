import type * as GeoJSON from "geojson";

export type LngLat = [number, number];

export type Category =
  | "official_landmark"
  | "supporting_location"
  | "rest_area"
  | "public_facility"
  | "starting_point"
  | "ending_point"
  | "route";

/** Properties written by scripts/kml-to-geojson.mjs */
export type SourceProps = {
  id: string;
  name: string;
  source_folder: string;
  source_folder_index: number;
  source_order: number;
  source_style: string | null;
  geometry_type: string;
  category: Category;
  route_position_km?: number;
  offset_from_route_m?: number;
};

export type SourceFeature = GeoJSON.Feature<GeoJSON.Geometry, SourceProps>;
export type SourceCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, SourceProps>;

export type WikiText = { title: string; url: string; paragraphs: string[]; license: string };
export type Photo = {
  src: string;
  width: number;
  height: number;
  page: string;
  caption: string;
  author: string;
  license: string;
};
export type FetchedContent = { article: WikiText | null; area: WikiText | null; photos: Photo[] };

/** Organiser-written section; `source` is required so nothing unsourced ships. */
export type Section = { key: SectionKey; body: string; source?: string };
export type SectionKey = "history" | "architecture" | "urban" | "cultural" | "spatial" | "facts" | "why";

export const SECTION_LABELS: Record<SectionKey, string> = {
  history: "Historical background",
  architecture: "Architectural significance",
  urban: "Urban significance",
  cultural: "Cultural significance",
  spatial: "Spatial experience",
  facts: "Interesting observations",
  why: "Why it matters",
};

export type StopConfig = {
  feature_id: string;
  display_name: string;
  area?: string;
  role?: "start" | "end";
  proximity_m?: number;
};

/** A segment is a slice of the original route, by distance along it. */
export type SegmentConfig = { id: string; name: string; start_km: number; end_km: number };

export type EventConfig = {
  id: string;
  title: string;
  kicker: string;
  location: string;
  city: string;
  organiser: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
  /** hero image: a stop and the index of one of its fetched photos */
  cover: { feature_id: string; photo: number };
  source_note: string;
  walking_speed_kmh: number;
  dwell_minutes_per_stop: number;
  corridor_m: number;
  default_proximity_m: number;
  stops: StopConfig[];
  segments: SegmentConfig[];
  category_overrides: Record<string, Category>;
  sections: Record<string, Section[]>;
};

export type BaseData = {
  event: EventConfig;
  route: SourceCollection;
  landmarks: SourceCollection;
  facilities: SourceCollection;
  restAreas: SourceCollection;
  corridor: GeoJSON.FeatureCollection;
  content: Record<string, FetchedContent>;
};

/** Everything the UI needs about one stop, resolved from KML + config + content. */
export type Stop = {
  id: string;
  number: number;
  name: string;
  sourceName: string;
  area: string;
  coord: LngLat;
  routeKm: number;
  offsetM: number;
  radiusM: number;
  role?: "start" | "end";
  short: string;
  content: FetchedContent | null;
  sections: Section[];
};

export type Place = {
  id: string;
  name: string;
  coord: LngLat;
  category: Category;
  routeKm: number;
  content: FetchedContent | null;
};

// ---- participant-generated content ----
export type GeoTag = { lat: number; lng: number; accuracy?: number } | null;

export type Post = {
  id: string;
  kind: "photo" | "observation";
  event_id: string;
  user_id: string;
  user_name: string;
  landmark_id: string | null;
  text: string;
  /** object URL / data URL / storage URL */
  image_url: string | null;
  geo: GeoTag;
  created_at: string;
  likes: number;
  liked_by_me: boolean;
  comments: Comment[];
  prompt?: string;
};

export type Comment = { id: string; user_name: string; content: string; created_at: string };

export type Progress = {
  event_id: string;
  visited: string[];
  started_at: string | null;
  completed_at: string | null;
};
