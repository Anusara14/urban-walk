"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight, Loader2, LogOut, Settings2 } from "lucide-react";
import { Wordmark } from "@/components/uw/brand";
import { displayName, sendCode, signInLocal, signOut, updateName, useAuth, verifyCode } from "@/lib/auth";
import { settleAfter } from "@/lib/motion";
import { backendMode } from "@/lib/supabase";

gsap.registerPlugin(useGSAP);

/** Only same-site paths, so ?next= can't bounce people to another domain. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") ? raw : "/walk";
}

const field = "h-14 w-full rounded-[18px] border border-white/15 bg-white/10 px-5 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-uw-yellow";

export function LoginScreen() {
  const { ready, account } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
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
  else body = <EmailCodeSteps />;

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
        {backendMode === "local" && !account && (
          <p className="lg-rise mt-5 text-[12px] leading-relaxed text-white/45">
            Development mode: your profile and posts stay on this device. Connect Supabase to sign in with email.
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

function EmailCodeSteps() {
  const [email, setEmail] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const { busy, error, run } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) run(async () => { setEmail(await sendCode(value)); setValue(""); });
    else run(() => verifyCode(email, value));
  };

  return (
    <form onSubmit={submit} noValidate>
      <label className="eyebrow block text-white/55" htmlFor="login-field">
        {email ? `Code sent to ${email}` : "Sign in or join with your email"}
      </label>
      {email ? (
        <input
          id="login-field" key="code" value={value} onChange={(e) => setValue(e.target.value)}
          inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} placeholder="6-digit code" autoFocus
          className={`${field} mt-2 tabular text-center text-[22px] tracking-[0.5em]`}
        />
      ) : (
        <input
          id="login-field" key="email" type="email" value={value} onChange={(e) => setValue(e.target.value)}
          autoComplete="email" inputMode="email" placeholder="you@university.lk" className={`${field} mt-2`}
        />
      )}
      <ErrorText error={error} />
      <Submit busy={busy}>{email ? "Verify and continue" : "Email me a code"}</Submit>
      {email && (
        <div className="mt-4 flex justify-between text-[13px] text-white/60">
          <button type="button" onClick={() => { setEmail(null); setValue(""); }} className="underline underline-offset-2">Use another email</button>
          <button type="button" disabled={busy} onClick={() => run(async () => { await sendCode(email); })} className="underline underline-offset-2">Send a new code</button>
        </div>
      )}
    </form>
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
        <span className="grid size-12 place-items-center rounded-full bg-uw-yellow text-[18px] font-semibold text-uw-ink">{displayName(account).slice(0, 1).toUpperCase()}</span>
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
