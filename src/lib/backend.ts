"use client";
// Participant content (photos, observations, comments, likes).
// Supabase when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set,
// otherwise a local-only development mode backed by IndexedDB on this device.
import { createStore, del, get, keys, set } from "idb-keyval";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentAccount, displayName, type Account } from "./auth";
import { backendMode, getSupabase } from "./supabase";
import type { GeoTag, Post, Progress, ProgressRow } from "./types";

export { backendMode };

export type NewPost = {
  kind: Post["kind"];
  event_id: string;
  landmark_id: string | null;
  text: string;
  image: Blob | null;
  thumb: Blob | null;
  geo: GeoTag;
  prompt?: string;
};

// Reading is public; writing needs a signed-in account.
function requireAccount(): Account {
  const a = currentAccount();
  if (!a) throw new Error("Sign in to post, comment or appreciate.");
  return a;
}

// ---------------- local (IndexedDB) ----------------
type StoredPost = Omit<Post, "image_url" | "thumb_url" | "liked_by_me"> & { image: Blob | null; thumb?: Blob | null; liked_by: string[] };
const idb = typeof window !== "undefined" ? createStore("urban-walk", "posts") : undefined;
const objectUrls = new Map<string, string>();
const urlFor = (key: string, blob: Blob | null | undefined) => {
  if (!blob) return null;
  const url = objectUrls.get(key) ?? URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
};

function toPost(s: StoredPost, me: string): Post {
  const { image, thumb, liked_by, ...rest } = s;
  return {
    ...rest,
    image_url: urlFor(s.id, image),
    thumb_url: urlFor(`${s.id}:thumb`, thumb),
    likes: liked_by.length,
    liked_by_me: liked_by.includes(me),
  };
}

const local = {
  async list(eventId: string): Promise<Post[]> {
    const me = currentAccount()?.id ?? "";
    const all = await Promise.all((await keys(idb)).map((k) => get<StoredPost>(k, idb)));
    return all
      .filter((p): p is StoredPost => !!p && p.event_id === eventId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => toPost(p, me));
  },
  async create(input: NewPost): Promise<Post> {
    const me = requireAccount();
    const stored: StoredPost = {
      id: crypto.randomUUID(),
      kind: input.kind,
      event_id: input.event_id,
      user_id: me.id,
      user_name: displayName(me),
      landmark_id: input.landmark_id,
      text: input.text,
      image: input.image,
      thumb: input.thumb,
      geo: input.geo,
      prompt: input.prompt,
      created_at: new Date().toISOString(),
      likes: 0,
      liked_by: [],
      comments: [],
    };
    await set(stored.id, stored, idb);
    return toPost(stored, me.id);
  },
  async update(id: string, fn: (p: StoredPost) => StoredPost) {
    const p = await get<StoredPost>(id, idb);
    if (!p) throw new Error("Post not found");
    await set(id, fn(p), idb);
  },
  async comment(postId: string, content: string) {
    const me = requireAccount();
    await local.update(postId, (p) => ({
      ...p,
      comments: [...p.comments, { id: crypto.randomUUID(), user_name: displayName(me), content, created_at: new Date().toISOString() }],
    }));
  },
  async like(postId: string) {
    const me = requireAccount().id;
    await local.update(postId, (p) => ({
      ...p,
      liked_by: p.liked_by.includes(me) ? p.liked_by.filter((x) => x !== me) : [...p.liked_by, me],
    }));
  },
  // progress lives in localStorage (walk-provider); nothing to sync on-device
  async syncProgress() {},
  async listProgress(eventId: string): Promise<ProgressRow[]> {
    const me = currentAccount();
    try {
      const raw = localStorage.getItem(`uw:progress:${eventId}`);
      if (!raw || !me) return [];
      const p = JSON.parse(raw) as Progress;
      return [{ user_id: me.id, user_name: displayName(me), completed_landmarks: p.visited, distance_covered_m: 0, started_at: p.started_at, completed_at: p.completed_at, updated_at: p.started_at ?? "" }];
    } catch {
      return [];
    }
  },
  async remove(postId: string) {
    for (const key of [postId, `${postId}:thumb`]) {
      const url = objectUrls.get(key);
      if (url) URL.revokeObjectURL(url);
      objectUrls.delete(key);
    }
    await del(postId, idb);
  },
};

// ---------------- Supabase ----------------
// Tables and policies: supabase/migrations/0001_urban_walk.sql
const sb = getSupabase;

type Row = {
  id: string; kind: Post["kind"]; event_id: string; user_id: string; user_name: string; landmark_id: string | null;
  content: string; image_path: string | null; thumb_path: string | null; lat: number | null; lng: number | null; accuracy_m: number | null;
  prompt: string | null; created_at: string;
  comments: { id: string; user_name: string; content: string; created_at: string }[];
  post_likes: { user_id: string }[];
};

async function uidOf(c: SupabaseClient) {
  const id = (await c.auth.getSession()).data.session?.user.id;
  if (!id) throw new Error("Sign in to post, comment or appreciate.");
  return id;
}

// Shared coordinates are rounded to 4 decimals (~11 m): enough to place a photo on the
// map without publishing anyone's exact position.
const coarse = (v?: number) => (v == null ? null : Math.round(v * 1e4) / 1e4);

const remote = {
  async list(eventId: string): Promise<Post[]> {
    const c = await sb();
    const me = (await c.auth.getSession()).data.session?.user.id;
    const { data, error } = await c
      .from("posts")
      .select("*, comments(id,user_name,content,created_at), post_likes(user_id)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      // ponytail: newest 500 rows (~80 KB gzipped, text only); add range() paging if an event goes past that
      .limit(500);
    if (error) throw new Error(error.message);
    return (data as Row[]).map((r) => ({
      id: r.id, kind: r.kind, event_id: r.event_id, user_id: r.user_id, user_name: r.user_name,
      landmark_id: r.landmark_id, text: r.content, prompt: r.prompt ?? undefined, created_at: r.created_at,
      image_url: r.image_path ? c.storage.from("photos").getPublicUrl(r.image_path).data.publicUrl : null,
      thumb_url: r.thumb_path ? c.storage.from("photos").getPublicUrl(r.thumb_path).data.publicUrl : null,
      geo: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng, accuracy: r.accuracy_m ?? undefined } : null,
      comments: [...r.comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      likes: r.post_likes.length,
      liked_by_me: r.post_likes.some((l) => l.user_id === me),
    }));
  },
  async create(input: NewPost): Promise<Post> {
    const c = await sb();
    const uid = await uidOf(c);
    const base = `${input.event_id}/${uid}/${crypto.randomUUID()}`;
    const upload = async (blob: Blob, suffix: string) => {
      const path = `${base}${suffix}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
      // a year of browser/CDN caching: paths are unique, files never change
      const up = await c.storage.from("photos").upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
      if (up.error) throw new Error(`Photo upload failed: ${up.error.message}`);
      return path;
    };
    const image_path = input.image ? await upload(input.image, "") : null;
    const thumb_path = input.thumb ? await upload(input.thumb, ".thumb") : null;
    const { data, error } = await c
      .from("posts")
      .insert({
        kind: input.kind, event_id: input.event_id, user_id: uid, user_name: displayName(requireAccount()),
        landmark_id: input.landmark_id, content: input.text, image_path, thumb_path, prompt: input.prompt ?? null,
        lat: coarse(input.geo?.lat), lng: coarse(input.geo?.lng), accuracy_m: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return (await remote.list(input.event_id)).find((p) => p.id === data.id)!;
  },
  async comment(postId: string, content: string) {
    const c = await sb();
    const uid = await uidOf(c);
    const { error } = await c.from("comments").insert({ post_id: postId, user_id: uid, user_name: displayName(requireAccount()), content });
    if (error) throw new Error(error.message);
  },
  async like(postId: string) {
    const c = await sb();
    const uid = await uidOf(c);
    const { data } = await c.from("post_likes").select("post_id").eq("post_id", postId).eq("user_id", uid);
    const q = data?.length
      ? c.from("post_likes").delete().eq("post_id", postId).eq("user_id", uid)
      : c.from("post_likes").upsert({ post_id: postId, user_id: uid }, { ignoreDuplicates: true }); // double-tap safe
    const { error } = await q;
    if (error) throw new Error(error.message);
  },
  /** Best-effort: progress also lives on the device, so a failed sync loses nothing. */
  async syncProgress(p: Progress, distanceM: number) {
    const a = currentAccount();
    if (!a) return;
    const c = await sb();
    await c.from("walk_progress").upsert(
      {
        user_id: a.id, user_name: displayName(a), event_id: p.event_id, completed_landmarks: p.visited,
        distance_covered_m: Math.round(distanceM), started_at: p.started_at, completed_at: p.completed_at, updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,event_id" },
    );
  },
  /** Organisers only (RLS); everyone else gets just their own row. */
  async listProgress(eventId: string): Promise<ProgressRow[]> {
    const c = await sb();
    const { data, error } = await c
      .from("walk_progress")
      .select("user_id,user_name,completed_landmarks,distance_covered_m,started_at,completed_at,updated_at")
      .eq("event_id", eventId)
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data as ProgressRow[];
  },
  async remove(postId: string) {
    const c = await sb();
    const { data: row } = await c.from("posts").select("image_path, thumb_path").eq("id", postId).single();
    const files = [row?.image_path, row?.thumb_path].filter((f): f is string => !!f);
    if (files.length) await c.storage.from("photos").remove(files);
    const { error } = await c.from("posts").delete().eq("id", postId);
    if (error) throw new Error(error.message);
  },
};

export const backend = backendMode === "supabase" ? remote : local;
