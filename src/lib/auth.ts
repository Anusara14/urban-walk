"use client";
// Participant accounts.
// Supabase mode: "Continue with Google" only. No passwords, no sign-in emails. Organisers are users whose
// app_metadata.role is "organiser" — set server-side, never from the client.
// Local mode: a name-only profile kept on this device, for development and demos.
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { backendMode, getSupabase } from "./supabase";

export type Account = { id: string; name: string; email: string | null; avatar: string | null; organiser: boolean };
type AuthState = { ready: boolean; account: Account | null };

const LOCAL_KEY = "uw:account";
const LEGACY_PROFILE_KEY = "uw:profile"; // pre-login profile; reuse its id so earlier posts stay "mine"

let state: AuthState = { ready: false, account: null };
const listeners = new Set<() => void>();
const emit = (next: AuthState) => {
  state = next;
  listeners.forEach((l) => l());
};

// Google fills name/full_name and picture/avatar_url; a rename from /login overwrites name.
const fromUser = (u: User): Account => ({
  id: u.id,
  name: String(u.user_metadata?.name ?? u.user_metadata?.full_name ?? "").trim().slice(0, 40),
  email: u.email ?? null,
  avatar: (u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null) as string | null,
  organiser: u.app_metadata?.role === "organiser",
});

let started = false;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (backendMode === "local") {
    let account: Account | null = null;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) account = JSON.parse(raw) as Account;
    } catch {}
    emit({ ready: true, account });
    return;
  }
  getSupabase()
    .then(async (c) => {
      const { data } = await c.auth.getSession();
      emit({ ready: true, account: data.session ? fromUser(data.session.user) : null });
      c.auth.onAuthStateChange((_e, session) => emit({ ready: true, account: session ? fromUser(session.user) : null }));
    })
    .catch(() => emit({ ready: true, account: null }));
}

const subscribe = (l: () => void) => {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
};
const SERVER_STATE: AuthState = { ready: false, account: null };

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

/** For non-React callers (data layer). */
export function currentAccount(): Account | null {
  start();
  return state.account;
}

export const displayName = (a: Account | null) => a?.name || "Participant";

/**
 * Test access to /admin without an organiser account: on `npm run dev`, or whenever no
 * Supabase project is connected (nothing to protect yet). A production build with
 * Supabase never qualifies, so a deployed event always requires a real organiser.
 */
export const adminTestAccess = process.env.NODE_ENV === "development" || backendMode === "local";

// ---------------- actions ----------------
const cleanName = (n: string) => n.trim().replace(/\s+/g, " ").slice(0, 40);

/** Full-page redirect to Google; Supabase sends the user back to /login?next=… signed in. */
export async function signInWithGoogle(next: string) {
  const c = await getSupabase();
  const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
  const { error } = await c.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } },
  });
  if (error) throw new Error(error.message);
}

/**
 * Google's own button (Google Identity Services) signs in on our origin, so Google's
 * screen names urbanwalk.vercel.app instead of the Supabase project URL. It hands us an
 * ID token, which Supabase verifies. The nonce goes to Google hashed and to Supabase raw.
 */
export async function signInWithGoogleIdToken(credential: string, nonce: string) {
  const c = await getSupabase();
  const { error } = await c.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
  if (error) throw new Error("Google sign-in didn't finish. Try again.");
}

export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

export async function updateName(name: string) {
  const n = cleanName(name);
  if (n.length < 2) throw new Error("Please enter your name.");
  if (backendMode === "local") {
    if (!state.account) throw new Error("Not signed in.");
    const next = { ...state.account, name: n };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    emit({ ready: true, account: next });
    return;
  }
  const c = await getSupabase();
  const { error } = await c.auth.updateUser({ data: { name: n } });
  if (error) throw new Error(error.message);
}

/** Development mode only: no email, no password, this device only. */
export function signInLocal(name: string) {
  const n = cleanName(name);
  if (n.length < 2) throw new Error("Please enter your name.");
  let id: string = crypto.randomUUID();
  try {
    const legacy = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (legacy) id = (JSON.parse(legacy) as { id?: string }).id ?? id;
  } catch {}
  // every local profile can open /admin so organisers can try it without a backend
  const account: Account = { id, name: n, email: null, avatar: null, organiser: true };
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(account));
  } catch {
    throw new Error("This browser is blocking storage, so it can't keep you signed in.");
  }
  emit({ ready: true, account });
}

export async function signOut() {
  if (backendMode === "local") {
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch {}
    emit({ ready: true, account: null });
    return;
  }
  const c = await getSupabase();
  await c.auth.signOut();
}
