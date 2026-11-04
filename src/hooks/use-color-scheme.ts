"use client";
import { useSyncExternalStore } from "react";

export type ColorScheme = "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** The phone's light/dark setting, for code that can't use CSS (the map). */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(QUERY).matches ? "dark" : "light"),
    () => "light",
  );
}
