"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Loader2, LogOut, Settings2 } from "lucide-react";
import { Wordmark } from "@/components/uw/brand";
import { displayName, signInLocal, signInWithGoogle, signOut, updateName, useAuth } from "@/lib/auth";
import { settleAfter } from "@/lib/motion";
import { backendMode } from "@/lib/supabase";
import { adminTestAccess } from "@/lib/auth";

gsap.registerPlugin(useGSAP);

/** Only same-site paths, so ?next= can't bounce people to another domain. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/walk";
}

const field = "h-14 w-full rounded-[18px] border border-white/15 bg-white/10 px-5 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-uw-yellow";

export function LoginScreen() {
  const { ready, account } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  // Supabase puts OAuth failures (e.g. the user cancelled) on the return URL
  const oauthError = params.get("error_description");
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const tl = gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .from(".lg-rise", { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.07 }, 0.1);
      return settleAfter(tl, 1800);
    },
    { scope: root },
  );

  let body: ReactNode;
  if (!ready) body = <p className="flex items-center gap-2 text-white/60"><Loader2 className="size-4 animate-spin" /> Checking your account…</p>;
  else if (account && account.name) body = <AccountCard next={next} />;
  else if (account) body = <NameStep onDone={() => router.replace(next)} />;
  else if (backendMode === "local") body = <LocalStep onDone={() => router.replace(next)} />;
  else body = <GoogleStep next={next} initialError={oauthError} />;

  return (
    <main ref={root} className="relative flex min-h-dvh flex-col overflow-hidden bg-uw-ink px-6 pb-10 text-white safe-top">
      {/* the route's yellow line, abstracted */}
      <svg aria-hidden className="pointer-events-none absolute -right-24 top-28 h-[520px] w-[420px] opacity-[0.16]" viewBox="0 0 420 520" fill="none">
        <path d="M380 20 C300 60 330 140 250 170 S120 200 140 290 S60 400 110 500" stroke="var(--uw-yellow)" strokeWidth="14" strokeLinecap="round" />
        {[[380, 20], [250, 170], [140, 290], [110, 500]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="16" fill="var(--uw-yellow)" />)}
      </svg>

      <header className="relative flex items-center justify-end pt-4">
        <Link href="/" className="lg-rise text-[13px] font-medium text-white/60 hover:text-white">Browse without signing in</Link>
      </header>

      <section className="relative mt-auto pt-16">
        <Wordmark className="lg-rise w-[86%] max-w-[340px] text-white" />
        <p className="lg-rise mt-5 max-w-[30ch] text-[17px] leading-snug text-white/75">
          Don’t just walk through the city. <span className="text-white">Understand the city.</span>
        </p>
        <div className="lg-rise mt-9">{body}</div>
        {adminTestAccess && (
          <Link href="/admin" className="lg-rise mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-uw-yellow underline-offset-4 hover:underline">
            <Settings2 className="size-4" /> Open the organiser dashboard (test mode)
          </Link>
        )}
        {backendMode === "local" && !account && (
          <p className="lg-rise mt-5 text-[12px] leading-relaxed text-white/45">
            Development mode: your profile and posts stay on this device. Connect Supabase to sign in with Google.
          </p>
        )}
      </section>
    </main>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button disabled={busy} className="press focus-ring mt-3 flex h-14 w-full items-center justify-between rounded-full bg-uw-yellow pl-6 pr-2 text-[15px] font-semibold text-uw-ink disabled:opacity-60">
      {children}
      <span className="grid size-10 place-items-center rounded-full bg-uw-ink text-uw-yellow">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
      </span>
    </button>
  );
}

const ErrorText = ({ error }: { error: string | null }) =>
  error ? <p role="alert" className="mt-3 text-[13px] text-[#ffb4a8]">{error}</p> : null;

function GoogleStep({ next, initialError }: { next: string; initialError: string | null }) {
  const { busy, error, run } = useAction();
  return (
    <div>
      <button
        onClick={() => run(() => signInWithGoogle(next))}
        disabled={busy}
        className="press focus-ring flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white text-[15px] font-semibold text-uw-ink disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <GoogleG />}
        Continue with Google
      </button>
      <ErrorText error={error ?? (initialError ? "Google sign-in didn't finish. Try again." : null)} />
      <p className="mt-4 text-[12px] leading-relaxed text-white/50">
        We use your Google name to label your posts. Your email is never shown to other participants.
      </p>
    </div>
  );
}

/** Google's "G" mark, as required by Google's sign-in branding guidelines. */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function LocalStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => { signInLocal(name); onDone(); }); }} noValidate>
      <label className="eyebrow block text-white/55" htmlFor="name-field">Your name, as shown on posts</label>
      <input id="name-field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} placeholder="e.g. Nimali Perera" className={`${field} mt-2`} />
      <ErrorText error={error} />
      <Submit busy={busy}>Start exploring</Submit>
    </form>
  );
}

function NameStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(async () => { await updateName(name); onDone(); }); }} noValidate>
      <label className="eyebrow block text-white/55" htmlFor="name-field">One last thing — your name on posts</label>
      <input id="name-field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} placeholder="e.g. Nimali Perera" autoFocus className={`${field} mt-2`} />
      <ErrorText error={error} />
      <Submit busy={busy}>Start exploring</Submit>
    </form>
  );
}

function AccountCard({ next }: { next: string }) {
  const { account } = useAuth();
  const [name, setName] = useState(account?.name ?? "");
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <div className="glass-dark rounded-[26px] p-5">
      <div className="flex items-center gap-3">
        {account?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google profile photo
          <img src={account.avatar} alt="" referrerPolicy="no-referrer" className="size-12 rounded-full object-cover" />
        ) : (
          <span className="grid size-12 place-items-center rounded-full bg-uw-yellow text-[18px] font-semibold text-uw-ink">{displayName(account).slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{displayName(account)}</p>
          <p className="truncate text-[12.5px] text-white/55">{account?.email ?? "Profile on this device"}{account?.organiser ? " · Organiser" : ""}</p>
        </div>
      </div>

      <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await updateName(name); setSaved(true); }); }}>
        <input aria-label="Display name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} maxLength={40} className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] outline-none focus:border-uw-yellow" />
        <button disabled={busy || name.trim() === account?.name} className="press h-11 rounded-full bg-white/15 px-4 text-[13px] font-medium disabled:opacity-40">{saved ? "Saved" : "Rename"}</button>
      </form>
      <ErrorText error={error} />

      <Link href={next} className="press mt-4 flex h-12 items-center justify-center rounded-full bg-uw-yellow text-[14.5px] font-semibold text-uw-ink">Continue</Link>
      <div className="mt-3 flex items-center justify-between text-[13px] text-white/65">
        {account?.organiser ? (
          <Link href="/admin" className="flex items-center gap-1.5 underline-offset-2 hover:underline"><Settings2 className="size-4" /> Organiser console</Link>
        ) : <span />}
        <button onClick={() => run(signOut)} className="flex items-center gap-1.5 hover:underline"><LogOut className="size-4" /> Sign out</button>
      </div>
    </div>
  );
}
