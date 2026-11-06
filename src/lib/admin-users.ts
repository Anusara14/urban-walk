"use client";
// Organiser-only account management. The database functions (supabase/migrations/0002_admin_users.sql)
// check the organiser role themselves; this file only calls them.
import { getSupabase } from "./supabase";

export type ManagedUser = {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  role: "organiser" | "participant" | string;
  created_at: string;
  last_sign_in_at: string | null;
  blocked: boolean;
  posts: number;
  visited: number;
};

// 42501 is also what signed-out callers get ("permission denied for function …")
const friendly = (e: { code?: string; message: string }) =>
  e.code === "42501" && /^(Organisers only|permission denied)/.test(e.message) ? "Sign in with an organiser account to manage users." : e.message;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const c = await getSupabase();
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(friendly(error));
  return data as T;
}

export const listUsers = () => rpc<ManagedUser[]>("admin_list_users");
export const setOrganiser = (id: string, organiser: boolean) => rpc<void>("admin_set_organiser", { target: id, make_organiser: organiser });
export const setBlocked = (id: string, blocked: boolean) => rpc<void>("admin_set_blocked", { target: id, block: blocked });

/** Removes the person's photo files first (the database can't reach storage), then the account and everything it owns. */
export async function deleteUser(id: string) {
  const c = await getSupabase();
  const { data, error } = await c.from("posts").select("image_path, thumb_path").eq("user_id", id);
  if (error) throw new Error(error.message);
  const files = (data ?? []).flatMap((r) => [r.image_path, r.thumb_path]).filter((p): p is string => !!p);
  if (files.length) {
    const { error: e } = await c.storage.from("photos").remove(files);
    if (e) throw new Error(`Couldn't remove their photos: ${e.message}`);
  }
  await rpc<void>("admin_delete_user", { target: id });
}
