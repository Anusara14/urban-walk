// Pure proximity rules so they can be tested without a browser (tests/proximity.test.ts).
import type { LngLat } from "./types";

export type ProximityStop = { id: string; coord: LngLat; radiusM: number };
export type ProximityMemory = {
  /** stop id -> last time we notified for it */
  notifiedAt: Record<string, number>;
  /** stops the user walked away from since the last notification (re-armed) */
  armed: Record<string, boolean>;
  lastToastAt: number;
};

export const PROXIMITY_RULES = {
  maxAccuracyM: 60,
  /** minimum gap between any two toasts */
  globalCooldownMs: 45_000,
  /** a stop can notify again only after the user left it and this much time passed */
  restopCooldownMs: 10 * 60_000,
  /** leaving = being farther than radius × this */
  leaveFactor: 2.5,
};

export const emptyMemory = (): ProximityMemory => ({ notifiedAt: {}, armed: {}, lastToastAt: 0 });

/**
 * Returns the stop to announce (or null) and the next memory. Never mutates input.
 * GPS accuracy widens the radius a little, but readings worse than maxAccuracyM are ignored.
 */
export function evaluateProximity(
  stops: ProximityStop[],
  pos: LngLat,
  accuracyM: number,
  memory: ProximityMemory,
  now: number,
  skip: ReadonlySet<string>,
  distanceM: (a: LngLat, b: LngLat) => number,
): { hit: ProximityStop | null; distance: number; memory: ProximityMemory } {
  if (accuracyM > PROXIMITY_RULES.maxAccuracyM) return { hit: null, distance: Infinity, memory };

  const armed = { ...memory.armed };
  let best: { stop: ProximityStop; d: number } | null = null;
  for (const s of stops) {
    const d = distanceM(pos, s.coord);
    if (d > s.radiusM * PROXIMITY_RULES.leaveFactor) armed[s.id] = true;
    const reach = s.radiusM + Math.min(accuracyM, 25) / 2;
    if (d <= reach && !skip.has(s.id) && (!best || d < best.d)) best = { stop: s, d };
  }

  const next = { ...memory, armed };
  if (!best) return { hit: null, distance: Infinity, memory: next };
  const id = best.stop.id;
  const last = memory.notifiedAt[id];
  const firstTime = last === undefined;
  const reArmed = !firstTime && armed[id] && now - last >= PROXIMITY_RULES.restopCooldownMs;
  const cooledDown = now - memory.lastToastAt >= PROXIMITY_RULES.globalCooldownMs;
  if (!(firstTime || reArmed) || !cooledDown) return { hit: null, distance: best.d, memory: next };

  return {
    hit: best.stop,
    distance: best.d,
    memory: { notifiedAt: { ...memory.notifiedAt, [id]: now }, armed: { ...armed, [id]: false }, lastToastAt: now },
  };
}
