"use client";

import { useSyncExternalStore } from "react";

export type DeviceTier = { lowPower: boolean; reducedMotion: boolean; saveData: boolean };

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };

let cached: DeviceTier | null = null;
function read(): DeviceTier {
  if (cached) return cached;
  const n = navigator as NavigatorHints;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = !!n.connection?.saveData || /(^|-)2g$/.test(n.connection?.effectiveType ?? "");
  // ponytail: coarse heuristic (memory/cores/save-data); a frame-time probe is the upgrade if this misjudges devices
  const lowPower = (n.deviceMemory !== undefined && n.deviceMemory <= 2) || (n.hardwareConcurrency ?? 8) <= 2 || saveData;
  cached = { lowPower, reducedMotion, saveData };
  return cached;
}

const SERVER: DeviceTier = { lowPower: false, reducedMotion: false, saveData: false };
const noop = () => () => {};

export function useDeviceTier(): DeviceTier {
  return useSyncExternalStore(noop, read, () => SERVER);
}
