"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const backendMode: "supabase" | "local" = SUPABASE_URL && SUPABASE_KEY ? "supabase" : "local";

let client: Promise<SupabaseClient> | null = null;

/** One lazily-loaded client for the whole app (auth + data share the session). */
export function getSupabase(): Promise<SupabaseClient> {
  client ??= import("@supabase/supabase-js")
    // PKCE: after the Google redirect, supabase-js exchanges ?code= for a session in the browser
    .then(({ createClient }) => createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { flowType: "pkce", detectSessionInUrl: true } }))
    .catch((e) => {
      client = null; // retry next call instead of caching the failure (e.g. offline at launch)
      throw e;
    });
  return client;
}
