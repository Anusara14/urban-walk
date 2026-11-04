"use client";

import { useEffect, useRef, useState } from "react";
import { makeNonce, signInWithGoogleIdToken } from "@/lib/auth";

// Public by design: it is part of every Google sign-in URL.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
// hl=en: the button's label comes from this script, which otherwise follows the browser language
const GSI_SRC = "https://accounts.google.com/gsi/client?hl=en";
const LOAD_TIMEOUT_MS = 6000;

type CredentialResponse = { credential?: string };
type GoogleId = {
  initialize: (o: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global {
  interface Window { google?: { accounts?: { id?: GoogleId } } }
}

let loader: Promise<GoogleId> | null = null;
function loadGsi(): Promise<GoogleId> {
  loader ??= new Promise<GoogleId>((resolve, reject) => {
    const done = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("GIS unavailable")));
    if (window.google?.accounts?.id) return done();
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.onload = done;
    s.onerror = () => reject(new Error("GIS blocked"));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("GIS timeout")), LOAD_TIMEOUT_MS);
  }).catch((e) => {
    loader = null; // allow a retry on the next visit
    throw e;
  });
  return loader;
}

type Props = {
  onSignedIn: () => void;
  onError: (message: string) => void;
  /** shown if Google's script can't load (blocked, offline) or no client id is configured */
  fallback: React.ReactNode;
};

/**
 * Google's official "Continue with Google" button. Falls back to the redirect flow
 * (which shows the Supabase URL on Google's screen) when GIS isn't available.
 */
export function GoogleButton({ onSignedIn, onError, fallback }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!CLIENT_ID);
  const [busy, setBusy] = useState(false);
  // latest callbacks for Google's (long-lived) callback, without re-initialising GIS
  const cb = useRef({ onSignedIn, onError });
  useEffect(() => {
    cb.current = { onSignedIn, onError };
  }, [onSignedIn, onError]);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    (async () => {
      try {
        const [gsi, nonce] = await Promise.all([loadGsi(), makeNonce()]);
        if (cancelled || !box.current) return;
        gsi.initialize({
          client_id: CLIENT_ID,
          nonce: nonce.hashed,
          context: "signin",
          ux_mode: "popup",
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async (res: CredentialResponse) => {
            if (!res.credential) return cb.current.onError("Google sign-in was cancelled.");
            setBusy(true);
            try {
              await signInWithGoogleIdToken(res.credential, nonce.raw);
              cb.current.onSignedIn();
            } catch (e) {
              cb.current.onError(e instanceof Error ? e.message : "Google sign-in didn't finish.");
            } finally {
              setBusy(false);
            }
          },
        });
        gsi.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          shape: "pill",
          size: "large",
          text: "continue_with",
          logo_alignment: "center",
          locale: "en", // match the app; Google otherwise follows the browser's language
          width: Math.min(400, Math.round(box.current.getBoundingClientRect().width)),
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <>{fallback}</>;
  return (
    <div className="relative">
      {/* Google draws its own button here (max 400px wide, so it's centred) */}
      <div ref={box} className="flex min-h-[44px] w-full justify-center" aria-busy={busy} />
      {busy && <p className="mt-2 text-center text-[12.5px] text-white/60">Signing you in…</p>}
    </div>
  );
}
