// Serve MapLibre's tile worker from our own origin instead of unpkg.com, so the
// map never depends on a third-party CDN. Runs before dev and build, so the copy
// always matches the installed maplibre-gl version. Output is git-ignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs"));
mkdirSync("public/maplibre", { recursive: true });
copyFileSync(path.join(dist, "maplibre-gl-worker.mjs"), "public/maplibre/maplibre-gl-worker.mjs");
