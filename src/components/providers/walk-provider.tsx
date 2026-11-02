"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { backend, type NewPost } from "@/lib/backend";
import { haversineM, projectOnLine } from "@/lib/geo";
import { emptyMemory, evaluateProximity, type ProximityMemory } from "@/lib/proximity";
import type { LngLat, Post, Progress, Stop } from "@/lib/types";
import { MAX_USABLE_ACCURACY_M, useGeolocation, type GeoState } from "@/hooks/use-geolocation";
import { useEvent } from "./event-provider";

/** Beyond this distance from the line we don't count GPS as progress along the route. */
const ON_ROUTE_M = 80;

export type Toast = { stop: Stop; distanceM: number; at: number };
export type ComposerState = { kind: "photo" | "observation"; landmarkId: string | null } | null;

type Ctx = {
  geo: GeoState;
  startLocation: () => void;
  userCoord: LngLat | null;
  progress: Progress;
  toggleVisited: (id: string) => void;
  resetProgress: () => void;
  /** 0..1 along the route */
  fraction: number;
  coveredM: number;
  nextStop: Stop | null;
  distanceTo: (coord: LngLat) => number | null;
  toast: Toast | null;
  dismissToast: () => void;
  composer: ComposerState;
  openComposer: (kind: "photo" | "observation", landmarkId?: string | null) => void;
  closeComposer: () => void;
  posts: Post[];
  postsError: string | null;
  createPost: (p: Omit<NewPost, "event_id">) => Promise<void>;
  comment: (postId: string, text: string) => Promise<void>;
  like: (postId: string) => Promise<void>;
  removePost: (postId: string) => Promise<void>;
  reloadPosts: () => Promise<void>;
};

const WalkContext = createContext<Ctx | null>(null);

const progressKey = (id: string) => `uw:progress:${id}`;
const emptyProgress = (event_id: string): Progress => ({ event_id, visited: [], started_at: null, completed_at: null });

export function WalkProvider({ children }: { children: ReactNode }) {
  const { model } = useEvent();
  const eventId = model.event.id;
  const { state: geo, start: startLocation } = useGeolocation();

  // ---------- progress ----------
  const [progress, setProgress] = useState<Progress>(() => emptyProgress(eventId));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(progressKey(eventId));
      if (raw) {
        // drop ids of stops an organiser has since removed
        const saved = JSON.parse(raw) as Progress;
        const ids = new Set(model.stops.map((s) => s.id));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from device storage after mount so SSR markup matches
        setProgress({ ...saved, visited: saved.visited.filter((v) => ids.has(v)) });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per event
  }, [eventId]);
  const persist = useCallback(
    (p: Progress) => {
      setProgress(p);
      try {
        localStorage.setItem(progressKey(eventId), JSON.stringify(p));
      } catch {}
      // share with organisers' dashboard (no-op in local mode)
      const furthestM = Math.max(0, ...model.stops.filter((s) => p.visited.includes(s.id)).map((s) => s.routeKm * 1000));
      backend.syncProgress(p, furthestM).catch(() => {});
    },
    [eventId, model.stops],
  );
  const toggleVisited = useCallback(
    (id: string) => {
      const visited = progress.visited.includes(id) ? progress.visited.filter((v) => v !== id) : [...progress.visited, id];
      const now = new Date().toISOString();
      persist({
        ...progress,
        visited,
        started_at: progress.started_at ?? now,
        completed_at: visited.length === model.stops.length ? now : null,
      });
    },
    [progress, persist, model.stops.length],
  );
  const resetProgress = useCallback(() => persist(emptyProgress(eventId)), [persist, eventId]);

  // ---------- position along route ----------
  const userCoord = useMemo<LngLat | null>(() => (geo.status === "active" ? [geo.lng, geo.lat] : null), [geo]);
  const userAlongM = useMemo(() => {
    if (geo.status !== "active" || geo.accuracy > MAX_USABLE_ACCURACY_M) return null;
    const p = projectOnLine(model.line, model.cum, [geo.lng, geo.lat]);
    return p.distM <= ON_ROUTE_M ? p.alongM : null;
  }, [geo, model.line, model.cum]);

  // GPS can only push progress forward of the furthest visited stop, never back.
  const visitedAlongM = Math.max(0, ...model.stops.filter((s) => progress.visited.includes(s.id)).map((s) => s.routeKm * 1000));
  const coveredM = Math.min(model.lengthM, Math.max(visitedAlongM, userAlongM ?? 0));
  const fraction = coveredM / model.lengthM;
  // next = first unvisited stop not already behind you on the route; else first unvisited
  const unvisited = model.stops.filter((s) => !progress.visited.includes(s.id));
  const nextStop = (userAlongM !== null && unvisited.find((s) => s.routeKm * 1000 >= userAlongM - s.radiusM)) || unvisited[0] || null;

  const distanceTo = useCallback(
    (coord: LngLat) => (geo.status === "active" ? haversineM([geo.lng, geo.lat], coord) : null),
    [geo],
  );

  // ---------- proximity toasts ----------
  const [toast, setToast] = useState<Toast | null>(null);
  const memory = useRef<ProximityMemory>(emptyMemory());
  useEffect(() => {
    if (geo.status !== "active") return;
    const r = evaluateProximity(
      model.stops,
      [geo.lng, geo.lat],
      geo.accuracy,
      memory.current,
      Date.now(),
      new Set(progress.visited),
      haversineM,
    );
    memory.current = r.memory;
    if (r.hit) {
      const stop = model.stops.find((s) => s.id === r.hit!.id)!;
      setToast({ stop, distanceM: r.distance, at: Date.now() });
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(40);
    }
  }, [geo, model.stops, progress.visited]);
  const dismissToast = useCallback(() => setToast(null), []);

  // ---------- sign-in gate: browsing is open, contributing needs an account ----------
  const { account, ready: authReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = useCallback(() => {
    if (account) return true;
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return false;
  }, [account, router, pathname]);

  // ---------- composer ----------
  const [composer, setComposer] = useState<ComposerState>(null);
  const openComposer = useCallback(
    (kind: "photo" | "observation", landmarkId: string | null = null) => {
      if (signedIn()) setComposer({ kind, landmarkId });
    },
    [signedIn],
  );
  const closeComposer = useCallback(() => setComposer(null), []);

  // ---------- posts ----------
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setPosts(await backend.list(eventId));
      setPostsError(null);
    } catch (e) {
      setPostsError(e instanceof Error ? e.message : "Could not load posts");
    }
  }, [eventId]);
  // reload when the account changes so "liked by me" / "mine" are right
  const accountId = account?.id;
  useEffect(() => {
    if (!authReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load; state is set after the await
    refresh();
  }, [refresh, authReady, accountId]);

  const createPost = useCallback(
    async (p: Omit<NewPost, "event_id">) => {
      await backend.create({ ...p, event_id: eventId });
      await refresh();
    },
    [eventId, refresh],
  );
  const comment = useCallback(async (id: string, text: string) => {
    if (!signedIn()) return;
    await backend.comment(id, text);
    await refresh();
  }, [refresh, signedIn]);
  const like = useCallback(async (id: string) => {
    if (!signedIn()) return;
    await backend.like(id);
    await refresh();
  }, [refresh, signedIn]);
  const removePost = useCallback(async (id: string) => { await backend.remove(id); await refresh(); }, [refresh]);

  const value = useMemo<Ctx>(() => ({
    geo, startLocation, userCoord, progress, toggleVisited, resetProgress, fraction, coveredM, nextStop, distanceTo,
    toast, dismissToast, composer, openComposer, closeComposer, posts, postsError, createPost, comment, like, removePost,
    reloadPosts: refresh,
  }), [refresh, geo, startLocation, userCoord, progress, toggleVisited, resetProgress, fraction, coveredM, nextStop, distanceTo,
    toast, dismissToast, composer, openComposer, closeComposer, posts, postsError, createPost, comment, like, removePost]);
  return <WalkContext.Provider value={value}>{children}</WalkContext.Provider>;
}

export function useWalk() {
  const ctx = useContext(WalkContext);
  if (!ctx) throw new Error("useWalk must be used inside WalkProvider");
  return ctx;
}
