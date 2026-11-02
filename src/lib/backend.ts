"use client";
// Participant content (photos, observations, comments, likes).
// Supabase when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set,
// otherwise a local-only development mode backed by IndexedDB on this device.
import { createStore, del, get, keys, set } from "idb-keyval";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentAccount, displayName, type Account } from "./auth";
import { backendMode, getSupabase } from "./supabase";
import type { GeoTag, Post } from "./types";

export { backendMode };

export type NewPost = {
  kind: Post["kind"];
  event_id: string;
  landmark_id: string | null;
  text: string;
  image: Blob | null;
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
type StoredPost = Omit<Post, "image_url" | "liked_by_me"> & { image: Blob | null; liked_by: string[] };
const idb = typeof window !== "undefined" ? createStore("urban-walk", "posts") : undefined;
const objectUrls = new Map<string, string>();

function toPost(s: StoredPost, me: string): Post {
  let image_url: string | null = null;
  if (s.image) {
    image_url = objectUrls.get(s.id) ?? URL.createObjectURL(s.image);
    objectUrls.set(s.id, image_url);
  }
  const { image: _image, liked_by, ...rest } = s;
  return { ...rest, image_url, likes: liked_by.length, liked_by_me: liked_by.includes(me) };
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
  async remove(postId: string) {
    const url = objectUrls.get(postId);
    if (url) URL.revokeObjectURL(url);
    objectUrls.delete(postId);
    await del(postId, idb);
  },
};

// ---------------- Supabase ----------------
// Tables and policies: supabase/migrations/0001_urban_walk.sql
const sb = getSupabase;

type Row = {
  id: string; kind: Post["kind"]; event_id: string; user_id: string; user_name: string; landmark_id: string | null;
  content: string; image_path: string | null; lat: number | null; lng: number | null; accuracy_m: number | null;
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
      .limit(200);
    if (error) throw new Error(error.message);
    return (data as Row[]).map((r) => ({
      id: r.id, kind: r.kind, event_id: r.event_id, user_id: r.user_id, user_name: r.user_name,
      landmark_id: r.landmark_id, text: r.content, prompt: r.prompt ?? undefined, created_at: r.created_at,
      image_url: r.image_path ? c.storage.from("photos").getPublicUrl(r.image_path).data.publicUrl : null,
      geo: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng, accuracy: r.accuracy_m ?? undefined } : null,
      comments: [...r.comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      likes: r.post_likes.length,
      liked_by_me: r.post_likes.some((l) => l.user_id === me),
    }));
  },
  async create(input: NewPost): Promise<Post> {
    const c = await sb();
    const uid = await uidOf(c);
    let image_path: string | null = null;
    if (input.image) {
      image_path = `${input.event_id}/${uid}/${crypto.randomUUID()}.${input.image.type === "image/webp" ? "webp" : "jpg"}`;
      const up = await c.storage.from("photos").upload(image_path, input.image, { contentType: input.image.type });
      if (up.error) throw new Error(`Photo upload failed: ${up.error.message}`);
    }
    const { data, error } = await c
      .from("posts")
      .insert({
        kind: input.kind, event_id: input.event_id, user_id: uid, user_name: displayName(requireAccount()),
        landmark_id: input.landmark_id, content: input.text, image_path, prompt: input.prompt ?? null,
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
  async remove(postId: string) {
    const c = await sb();
    const { data: row } = await c.from("posts").select("image_path").eq("id", postId).single();
    if (row?.image_path) await c.storage.from("photos").remove([row.image_path]);
    const { error } = await c.from("posts").delete().eq("id", postId);
    if (error) throw new Error(error.message);
  },
};

export const backend = backendMode === "supabase" ? remote : local;
