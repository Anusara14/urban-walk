import type { LngLat } from "./types";

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LngLat, b: LngLat) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cumulative distance (m) at each vertex. */
export function cumulative(line: LngLat[]) {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + haversineM(line[i - 1], line[i]));
  return out;
}

/**
 * Closest point on the line to p. Planar projection in a local equirectangular
 * frame — accurate to centimetres at walking scale.
 * ponytail: linear scan over vertices; fine for a few thousand points.
 */
export function projectOnLine(line: LngLat[], cum: number[], p: LngLat) {
  const kx = Math.cos(rad(p[1])) * 111320;
  const ky = 110540;
  let best = { distM: Infinity, alongM: 0, point: line[0] as LngLat };
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = [(line[i][0] - p[0]) * kx, (line[i][1] - p[1]) * ky];
    const [bx, by] = [(line[i + 1][0] - p[0]) * kx, (line[i + 1][1] - p[1]) * ky];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = Math.hypot(cx, cy);
    if (d < best.distM) {
      best = {
        distM: d,
        alongM: cum[i] + t * (cum[i + 1] - cum[i]),
        point: [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])],
      };
    }
  }
  return best;
}

/** Sub-line between two distances along the route (metres). */
export function sliceLine(line: LngLat[], cum: number[], fromM: number, toM: number): LngLat[] {
  const at = (m: number): LngLat => {
    const j = cum.findIndex((c) => c >= m);
    const i = j < 0 ? cum.length - 2 : Math.max(0, j - 1); // past the end clamps to the last segment
    const seg = cum[i + 1] - cum[i] || 1;
    const t = Math.max(0, Math.min(1, (m - cum[i]) / seg));
    return [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])];
  };
  const inner = line.filter((_, i) => cum[i] > fromM && cum[i] < toM);
  return [at(fromM), ...inner, at(toM)];
}

export function bounds(coords: LngLat[]): [LngLat, LngLat] {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of coords) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return [[minX, minY], [maxX, maxY]];
}

export const fmtDistance = (m: number) => (m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
export const fmtMinutes = (min: number) =>
  min < 60 ? `${Math.max(1, Math.round(min))} min` : `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;
