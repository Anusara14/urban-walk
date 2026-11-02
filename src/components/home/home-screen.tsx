"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight, CalendarDays, MapPin, Route } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { Credit, WikiImage } from "@/components/uw/wiki-image";
import { StopBadge } from "@/components/uw/stop-badge";
import { AccountButton } from "@/components/uw/account-button";
import { Wordmark } from "@/components/uw/brand";
import { MadeBy } from "@/components/uw/made-by";
import { fmtMinutes } from "@/lib/geo";
import { settleAfter } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

function fmtDate(iso: string | null) {
  if (!iso) return "Date to be announced";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function HomeScreen() {
  const { model } = useEvent();
  const { startLocation, progress } = useWalk();
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const ev = model.event;
  const coverStop = model.stops.find((s) => s.id === ev.cover.feature_id) ?? model.stops[0];
  const cover = coverStop?.content?.photos[ev.cover.photo] ?? coverStop?.content?.photos[0];

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".h-cover", { scale: 1.08, duration: 1.6 }, 0)
        .from(".h-rise", { yPercent: 40, autoAlpha: 0, duration: 0.9, stagger: 0.07 }, 0.15)
        .from(".h-card", { x: 40, autoAlpha: 0, duration: 0.8, stagger: 0.05 }, 0.45);
      return settleAfter(tl, 2400);
    },
    { scope: root },
  );

  const start = () => {
    startLocation(); // asks for permission from a user gesture, as browsers require
    router.push("/walk");
  };
  const started = progress.visited.length > 0;
  const [first, ...rest] = ev.title.split(" ");

  return (
    <main ref={root} className="relative min-h-dvh overflow-hidden bg-uw-ink pb-32 text-white">
      {/* hero */}
      <section className="relative h-[78dvh] min-h-[540px] overflow-hidden rounded-b-[36px] md:h-[72dvh] md:max-h-[860px] md:rounded-b-[48px] [@media(max-height:560px)]:h-auto [@media(max-height:560px)]:min-h-[100dvh]">
        {cover && <WikiImage photo={cover} sizes="(max-width: 440px) 100vw, 440px" priority className="h-cover absolute inset-0 size-full" alt={coverStop?.name ?? ""} />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-black/90" />

        <header className="px-content relative flex items-center justify-between safe-top">
          <div className="h-rise flex items-center gap-2.5 pt-1">
            <Wordmark className="w-[150px] text-white" />
          </div>
          <AccountButton tone="dark" className="h-rise" />
        </header>

        <div className="px-content absolute inset-x-0 bottom-0 pb-7 [@media(max-height:560px)]:relative [@media(max-height:560px)]:pt-10">
          <p className="h-rise eyebrow text-on-photo text-white/90">{ev.kicker}</p>
          <h1 className="display text-on-photo mt-3 text-[clamp(44px,15vw,96px)] [@media(max-height:560px)]:text-[56px]">
            <span className="h-rise block">{first}</span>
            <span className="h-rise block">{rest.join(" ")}</span>
          </h1>
          <p className="h-rise text-on-photo mt-3 flex items-center gap-1.5 text-[14px] text-white">
            <MapPin className="size-4" /> {ev.location}
          </p>

          <dl className="h-rise mt-5 grid grid-cols-3 gap-2">
            {[
              ["Stops", String(model.stops.length)],
              ["Distance", `${(model.lengthM / 1000).toFixed(1)} km`],
              ["Duration", `≈ ${fmtMinutes(model.totalMinutes)}`],
            ].map(([k, v]) => (
              <div key={k} className="glass-dark rounded-[18px] px-3 py-2.5">
                <dt className="text-[10.5px] uppercase tracking-[0.12em] text-white/65">{k}</dt>
                <dd className="tabular mt-0.5 text-[17px] font-semibold tracking-tight">{v}</dd>
              </div>
            ))}
          </dl>
          {cover && <Credit photo={cover} className="mt-3 block text-white" />}
        </div>
      </section>

      {/* event info */}
      <section className="px-content pt-7">
        <p className="h-rise flex items-center gap-2 text-[13px] text-white/70">
          <CalendarDays className="size-4" /> {fmtDate(ev.start_date)} · {ev.organiser}
        </p>
        <p className="h-rise mt-3 text-[16px] leading-relaxed text-white/90">{ev.description}</p>

        <div className="h-rise mt-6 flex gap-2.5">
          <button onClick={start} className="press focus-ring flex h-14 flex-1 items-center justify-between rounded-full bg-uw-yellow pl-6 pr-2 text-[15px] font-semibold text-uw-ink">
            {started ? "Continue walking" : "Start walking"}
            <span className="grid size-10 place-items-center rounded-full bg-uw-ink text-uw-yellow"><ArrowRight className="size-5" /></span>
          </button>
          <Link href="/walk" className="press focus-ring glass-dark flex h-14 items-center gap-2 rounded-full px-5 text-[14px] font-medium">
            <Route className="size-4" /> Explore route
          </Link>
        </div>
      </section>

      {/* stops carousel */}
      <section className="mt-9">
        <div className="px-content flex items-baseline justify-between">
          <h2 className="text-[20px] font-semibold tracking-tight">Along the way</h2>
          <span className="text-[12px] text-white/55">Swipe</span>
        </div>
        <ol className="pl-content scroll-pl-content mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-none">
          {model.stops.map((s) => {
            const photo = s.content?.photos[0];
            return (
              <li key={s.id} className="h-card snap-start">
                <Link href={`/landmark/${s.id}`} className="press relative block h-[210px] w-[156px] overflow-hidden rounded-[24px] bg-uw-charcoal md:h-[260px] md:w-[196px]">
                  {photo && <WikiImage photo={photo} sizes="156px" maxWidth={500} className="absolute inset-0 size-full" alt="" />}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent" />
                  <StopBadge n={s.number} className="absolute left-2.5 top-2.5" />
                  <span className="absolute inset-x-3 bottom-3 text-[14px] font-semibold leading-tight">{s.name}</span>
                </Link>
              </li>
            );
          })}
          {/* end inset = this 8px spacer + the 12px gap; trailing padding is unreliable in flex scrollers */}
          <li aria-hidden className="w-2 shrink-0" />
        </ol>
      </section>

      <div className="px-content mt-8">
        <p className="rounded-[20px] border border-white/10 p-4 text-[12px] leading-relaxed text-white/55">{ev.source_note}</p>
        <MadeBy tone="dark" className="mt-6 justify-center" />
      </div>
    </main>
  );
}
