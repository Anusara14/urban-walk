"use client";
// Participant accounts.
// Supabase mode: "Continue with Google", or a passwordless email code. No passwords anywhere.
// Email needs custom SMTP in Supabase for real use: the built-in sender only reaches the
// organisation's own members and a few emails per hour. Organisers are users whose
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Plain-language messages for the auth error codes participants can actually hit. */
function emailAuthError(code: string | undefined, fallback: string) {
  switch (code) {
    case "email_address_not_authorized":
      return "Email sign-in isn't fully set up yet. Please use Continue with Google for now.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many sign-in emails were requested. Wait a minute and try again, or use Google.";
    case "otp_expired":
      return "That code has expired. Send a new one.";
    case "email_address_invalid":
      return "That email address doesn't look right.";
    default:
      return fallback;
  }
}

/**
 * Passwordless email sign-in. Sends one email containing a 6-digit code (when the
 * Magic Link template includes {{ .Token }}) and a sign-in link back to /login.
 */
export async function sendEmailCode(email: string, next: string) {
  const e = email.trim().toLowerCase();
  if (!EMAIL.test(e)) throw new Error("Enter a valid email address.");
  const c = await getSupabase();
  const { error } = await c.auth.signInWithOtp({
    email: e,
    options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}` },
  });
  if (error) throw new Error(emailAuthError(error.code, error.message));
  return e;
}

export async function verifyEmailCode(email: string, code: string) {
  const token = code.replace(/\D/g, "");
  if (token.length !== 6) throw new Error("The code has 6 digits.");
  const c = await getSupabase();
  const { error } = await c.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new Error(emailAuthError(error.code, "That code didn't work. Check the latest email, or send a new code."));
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
