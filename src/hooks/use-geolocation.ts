"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeoState =
  | { status: "idle" | "unsupported" | "requesting" }
  | { status: "denied" | "error"; message: string }
  | { status: "active"; lat: number; lng: number; accuracy: number; heading: number | null; at: number };

/** Readings worse than this are shown but not used for proximity triggers. */
export const MAX_USABLE_ACCURACY_M = 60;

/**
 * Opt-in GPS. Nothing is requested until `start()` — unless permission was
 * already granted earlier, in which case watching resumes silently.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const watchId = useRef<number | null>(null);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "unsupported" });
      return;
    }
    if (watchId.current !== null) return;
    setState((s) => (s.status === "active" ? s : { status: "requesting" }));
    watchId.current = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          status: "active",
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          heading: p.coords.heading,
          at: p.timestamp,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          setState({ status: "denied", message: "Location access was denied. You can still browse every stop manually." });
          return;
        }
        // Timeouts happen between tall buildings; keep watching and keep the last fix if we have one.
        setState((s) =>
          s.status === "active"
            ? s
            : { status: "error", message: err.code === err.TIMEOUT ? "Finding your location is taking a while." : "Location is unavailable right now." },
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, []);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setState({ status: "idle" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (!cancelled && p.state === "granted") start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [start]);

  return { state, start, stop };
}
