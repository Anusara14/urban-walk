// Converts the Google My Maps KML export into the GeoJSON files the app reads,
// plus a validation report. Run: npm run data:kml
// The KML is authoritative: coordinates and names are copied verbatim.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import * as turf from "@turf/turf";

const SRC = "data/source/urban-walk.kml";
const OUT = "public/data";
const NEAR_DUPLICATE_M = 60;

const doc = new DOMParser().parseFromString(readFileSync(SRC, "utf8"), "text/xml");

// togeojson flattens folders, so walk them ourselves to keep folder + order.
const folders = [...doc.getElementsByTagName("Folder")].map((folder) => {
  const name = folder.getElementsByTagName("name")[0].textContent.trim();
  const placemarks = [...folder.getElementsByTagName("Placemark")];
  return { name, placemarks };
});

const slug = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const all = [];
const invalid = [];
for (const [folderIndex, { name: folder, placemarks }] of folders.entries()) {
  placemarks.forEach((pm, i) => {
    // Parse one placemark at a time with togeojson (proper KML geometry handling).
    const wrapper = new DOMParser().parseFromString(
      `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${pm.toString()}</Document></kml>`,
      "text/xml",
    );
    const [f] = kmlToGeoJSON(wrapper).features;
    const name = f?.properties?.name?.trim() ?? `(unnamed ${i})`;
    if (!f?.geometry) {
      invalid.push({ folder, index: i, name, reason: "missing geometry" });
      return;
    }
    // Drop altitude (always 0 in this export) to keep files lean; lon/lat untouched.
    f.geometry = turf.truncate(f.geometry, { precision: 10, coordinates: 2 });
    const styleUrl = pm.getElementsByTagName("styleUrl")[0]?.textContent ?? null;
    f.id = `${slug(folder)}--${String(i).padStart(2, "0")}--${slug(name)}`;
    f.properties = {
      id: f.id,
      name,
      source_folder: folder,
      source_folder_index: folderIndex,
      source_order: i,
      source_style: styleUrl,
      geometry_type: f.geometry.type,
      category: categorise(folder, name, f.geometry.type, styleUrl),
    };
    all.push(f);
  });
}

function categorise(folder, name, type, style) {
  if (type === "LineString") return "route";
  if (type === "Polygon") return "rest_area";
  if (folder === "Urban Walk Final Route") {
    return name.startsWith("Old Town Hall") ? "starting_point" : "ending_point";
  }
  if (style?.includes("icon-1733") || /washroom/i.test(name)) return "public_facility";
  if (folder === "Finalized Layer") return "official_landmark";
  return "supporting_location";
}

const fc = (features) => ({ type: "FeatureCollection", features });
const routeFeature = all.find((f) => f.properties.category === "route");
const route = routeFeature.geometry;
const routeKm = turf.length(routeFeature, { units: "kilometers" });

// Position of every point along the route — used for stop ordering, never to move points.
for (const f of all) {
  if (f.geometry.type !== "Point") continue;
  const snapped = turf.nearestPointOnLine(route, f.geometry, { units: "kilometers" });
  f.properties.route_position_km = +snapped.properties.location.toFixed(4);
  f.properties.offset_from_route_m = Math.round(snapped.properties.dist * 1000);
}

const pick = (...cats) => all.filter((f) => cats.includes(f.properties.category));
const landmarks = pick("official_landmark", "supporting_location", "starting_point", "ending_point");
const write = (file, data) => writeFileSync(`${OUT}/${file}`, JSON.stringify(data, null, 1) + "\n");
mkdirSync(OUT, { recursive: true });
write("urban-walk-route.geojson", fc([routeFeature]));
write("urban-walk-landmarks.geojson", fc(landmarks));
write("urban-walk-facilities.geojson", fc(pick("public_facility")));
write("urban-walk-rest-areas.geojson", fc(pick("rest_area")));
write("urban-walk-all-features.geojson", fc(all));
// Derived (not from KML): walking corridor used to scope the 3D building layer.
const CORRIDOR_M = 150;
const corridor = turf.buffer(routeFeature, CORRIDOR_M, { units: "meters", steps: 6 });
corridor.properties = { derived_from: routeFeature.id, buffer_m: CORRIDOR_M };
write("urban-walk-corridor.geojson", fc([turf.truncate(corridor, { precision: 6 })]));

// ---------- validation report ----------
const points = all.filter((f) => f.geometry.type === "Point");
const dupes = [];
for (let i = 0; i < points.length; i++) {
  for (let j = i + 1; j < points.length; j++) {
    const a = points[i], b = points[j];
    const m = turf.distance(a, b, { units: "meters" });
    if (m <= NEAR_DUPLICATE_M) {
      dupes.push({
        a: `${a.properties.name} [${a.properties.source_folder}]`,
        b: `${b.properties.name} [${b.properties.source_folder}]`,
        distance_m: +m.toFixed(1),
      });
    }
  }
}
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const locNames = points.filter((f) => f.properties.source_folder === "locations");
const finNames = points.filter((f) => f.properties.source_folder === "Finalized Layer");
const closest = (f, pool) =>
  pool
    .map((g) => ({ g, m: turf.distance(f, g, { units: "meters" }) }))
    .sort((x, y) => x.m - y.m)[0];
const folderDiff = {
  finalized_matched_in_locations: finNames
    .filter((f) => f.properties.category !== "public_facility")
    .map((f) => {
      const c = closest(f, locNames);
      return {
        finalized: f.properties.name,
        closest_location: c.g.properties.name,
        distance_m: +c.m.toFixed(1),
        exact_name: norm(c.g.properties.name) === norm(f.properties.name),
      };
    }),
  only_in_locations: locNames
    .filter((f) => closest(f, finNames).m > NEAR_DUPLICATE_M)
    .map((f) => f.properties.name),
};

const bbox = turf.bbox(fc(all));
const counts = {};
for (const f of all) {
  const k = `${f.properties.source_folder} / ${f.geometry.type}`;
  counts[k] = (counts[k] ?? 0) + 1;
}
const routeCoords = route.coordinates;
const start = all.find((f) => f.properties.category === "starting_point");
const end = all.find((f) => f.properties.category === "ending_point");
const report = {
  source: SRC,
  generated_at: new Date().toISOString(),
  crs: "EPSG:4326 (lon, lat)",
  document_description: doc.getElementsByTagName("description")[0]?.textContent.replace(/<[^>]+>/g, "").trim(),
  total_features: all.length,
  counts_by_folder_and_type: counts,
  route: {
    coordinate_count: routeCoords.length,
    length_km: +routeKm.toFixed(3),
    first_vertex: routeCoords[0],
    last_vertex: routeCoords.at(-1),
    start_marker: { name: start.properties.name, gap_to_first_vertex_m: Math.round(turf.distance(start, turf.point(routeCoords[0]), { units: "meters" })) },
    end_marker: { name: end.properties.name, gap_to_last_vertex_m: Math.round(turf.distance(end, turf.point(routeCoords.at(-1)), { units: "meters" })) },
    segments_in_source: "none — single LineString; '06 Segments' appears only in the document description",
  },
  bbox_lon_lat: bbox.map((v) => +v.toFixed(6)),
  invalid_geometries: invalid,
  near_duplicates_within_m: NEAR_DUPLICATE_M,
  near_duplicates: dupes,
  folder_differences: folderDiff,
};
write("validation-report.json", report);

const md = [
  `# KML validation report`,
  ``,
  `Source: \`${SRC}\` · generated ${report.generated_at}`,
  ``,
  `- Features extracted: **${all.length}**`,
  ...Object.entries(counts).map(([k, v]) => `  - ${k}: ${v}`),
  `- Route coordinates: **${routeCoords.length}** (length ${report.route.length_km} km)`,
  `- Start marker: ${start.properties.name} — ${report.route.start_marker.gap_to_first_vertex_m} m from first route vertex`,
  `- End marker: ${end.properties.name} — ${report.route.end_marker.gap_to_last_vertex_m} m from last route vertex`,
  `- Segments: ${report.route.segments_in_source}`,
  `- Bounding box (minLon, minLat, maxLon, maxLat): ${report.bbox_lon_lat.join(", ")}`,
  `- Invalid / missing geometries: ${invalid.length ? invalid.map((x) => `${x.name} (${x.reason})`).join("; ") : "none"}`,
  ``,
  `## Near-duplicate points (≤ ${NEAR_DUPLICATE_M} m)`,
  ``,
  `| A | B | Distance (m) |`,
  `|---|---|---|`,
  ...dupes.map((d) => `| ${d.a} | ${d.b} | ${d.distance_m} |`),
  ``,
  `## Finalized Layer vs locations`,
  ``,
  `| Finalized | Closest in locations | Distance (m) | Same name |`,
  `|---|---|---|---|`,
  ...folderDiff.finalized_matched_in_locations.map((d) => `| ${d.finalized} | ${d.closest_location} | ${d.distance_m} | ${d.exact_name ? "yes" : "no (spelling differs)"} |`),
  ``,
  `Only in \`locations\` (no Finalized point within ${NEAR_DUPLICATE_M} m): ${folderDiff.only_in_locations.join(", ")}`,
  ``,
].join("\n");
writeFileSync("data/validation-report.md", md);
console.log(md);
