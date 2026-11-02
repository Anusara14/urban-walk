"use client";
// Participant accounts.
// Supabase mode: passwordless email sign-in with a 6-digit code (works on any phone,
// no redirect back into the app needed). Organisers are users whose
// app_metadata.role is "organiser" — set server-side, never from the client.
// Local mode: a name-only profile kept on this device, for development and demos.
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { backendMode, getSupabase } from "./supabase";

export type Account = { id: string; name: string; email: string | null; organiser: boolean };
type AuthState = { ready: boolean; account: Account | null };

const LOCAL_KEY = "uw:account";
const LEGACY_PROFILE_KEY = "uw:profile"; // pre-login profile; reuse its id so earlier posts stay "mine"

let state: AuthState = { ready: false, account: null };
const listeners = new Set<() => void>();
const emit = (next: AuthState) => {
  state = next;
  listeners.forEach((l) => l());
};

const fromUser = (u: User): Account => ({
  id: u.id,
  name: String(u.user_metadata?.name ?? "").trim(),
  email: u.email ?? null,
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

// ---------------- actions ----------------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanName = (n: string) => n.trim().replace(/\s+/g, " ").slice(0, 40);

export async function sendCode(email: string) {
  const e = email.trim().toLowerCase();
  if (!EMAIL.test(e)) throw new Error("Enter a valid email address.");
  const c = await getSupabase();
  const { error } = await c.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.status === 429 ? "Too many attempts — wait a minute and try again." : error.message);
  return e;
}

export async function verifyCode(email: string, code: string) {
  const token = code.replace(/\D/g, "");
  if (token.length !== 6) throw new Error("The code has 6 digits.");
  const c = await getSupabase();
  const { error } = await c.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw new Error("That code didn't work. Check the latest email or send a new code.");
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
  const account: Account = { id, name: n, email: null, organiser: true };
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
