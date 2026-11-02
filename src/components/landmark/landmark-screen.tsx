"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, ArrowRight, Camera, Check, ChevronLeft, ExternalLink, Map as MapIcon, PenLine } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import { OBSERVATION_PROMPTS } from "@/components/uw/composer";
import { PostCard } from "@/components/community/post-card";
import { StopBadge } from "@/components/uw/stop-badge";
import { Credit, WikiImage } from "@/components/uw/wiki-image";
import { CATEGORY_LABEL } from "@/lib/event-model";
import { fmtDistance, haversineM } from "@/lib/geo";
import { SECTION_LABELS, type FetchedContent, type Stop } from "@/lib/types";
import { cn } from "@/lib/utils";
import { settleAfter } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

export function LandmarkScreen({ id }: { id: string }) {
  const { model } = useEvent();
  const walk = useWalk();
  const router = useRouter();
  const root = useRef<HTMLElement>(null);

  const stop = model.stops.find((s) => s.id === id) ?? null;
  const place = stop ? null : model.places.find((p) => p.id === id) ?? model.facilities.find((p) => p.id === id) ?? null;
  const target = stop ?? place;

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } })
        .from(".lm-hero", { scale: 1.06, duration: 1.4 }, 0)
        .from(".lm-body", { y: 50, autoAlpha: 0, duration: 0.8 }, 0.1)
        .from(".lm-chip", { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 0.2);
      return settleAfter(tl, 2000);
    },
    { scope: root, dependencies: [id], revertOnUpdate: true },
  );

  if (!target) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <p className="display text-[40px]">Not on this walk</p>
          <Link href="/walk" className="mt-4 inline-block underline">Back to the map</Link>
        </div>
      </main>
    );
  }

  const content: FetchedContent | null = target.content;
  const photos = content?.photos ?? [];
  const hero = photos[0];
  const d = walk.distanceTo(target.coord);
  const visited = stop ? walk.progress.visited.includes(stop.id) : false;
  const posts = stop ? walk.posts.filter((p) => p.landmark_id === stop.id) : [];
  const prev = stop ? model.stops[stop.number - 2] : undefined;
  const next = stop ? model.stops[stop.number] : undefined;
  const nearby = model.places
    .filter((p) => p.id !== target.id && haversineM(p.coord, target.coord) < 300)
    .sort((a, b) => haversineM(a.coord, target.coord) - haversineM(b.coord, target.coord))
    .slice(0, 4);

  return (
    <main ref={root} className="relative min-h-dvh bg-uw-paper pb-36">
      {/* hero */}
      <section className="relative h-[64dvh] min-h-[420px] overflow-hidden bg-uw-charcoal md:max-h-[720px] [@media(max-height:560px)]:min-h-[320px]">
        {hero && <WikiImage photo={hero} sizes="(max-width: 440px) 100vw, 440px" priority className="lm-hero absolute inset-0 size-full" alt={target.name} />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/60" />
        <div className="px-content absolute inset-x-0 top-0 flex items-center justify-between safe-top">
          <button onClick={() => (history.length > 1 ? router.back() : router.push("/walk"))} aria-label="Back" className="press glass-dark grid size-14 place-items-center rounded-full">
            <ChevronLeft className="size-6" strokeWidth={1.75} />
          </button>
          <Link href={`/walk?stop=${target.id}`} className="press glass-dark flex h-11 items-center gap-2 rounded-full px-4 text-[13px] font-medium">
            <MapIcon className="size-4" /> On the map
          </Link>
        </div>

        {/* floating fact chips — only facts we actually hold (position, distance) */}
        <div className="inset-x-content absolute bottom-12 flex flex-wrap gap-2">
          {stop && (
            <span className="lm-chip glass-dark flex items-center gap-2 rounded-[18px] px-3.5 py-2.5">
              <StopBadge n={stop.number} visited={visited} />
              <span className="leading-tight">
                <span className="block text-[16px] font-semibold">Stop {String(stop.number).padStart(2, "0")}</span>
                <span className="block text-[10.5px] text-white/70">of {model.stops.length}</span>
              </span>
            </span>
          )}
          <span className="lm-chip glass-dark rounded-[18px] px-3.5 py-2.5 leading-tight">
            <span className="tabular block text-[16px] font-semibold">{(stop?.routeKm ?? place!.routeKm).toFixed(2)} km</span>
            <span className="block text-[10.5px] text-white/70">along the route</span>
          </span>
          {d !== null && (
            <span className="lm-chip glass-dark rounded-[18px] px-3.5 py-2.5 leading-tight">
              <span className="tabular block text-[16px] font-semibold">{fmtDistance(d)}</span>
              <span className="block text-[10.5px] text-white/70">from you</span>
            </span>
          )}
        </div>
        {hero && <Credit photo={hero} className="inset-x-content absolute bottom-4 text-white" />}
      </section>

      {/* body */}
      <article className="lm-body px-content relative -mt-6 rounded-t-[30px] bg-uw-paper pt-7">
        <p className="eyebrow text-uw-slate">{stop ? `${stop.area} · Official stop` : CATEGORY_LABEL[place!.category]}</p>
        <h1 className="display mt-2 text-[clamp(34px,11vw,64px)]">{target.name}</h1>
        {stop && stop.sourceName !== stop.name && (
          <p className="mt-2 text-[12px] text-uw-slate">Labelled “{stop.sourceName}” in the organisers’ map.</p>
        )}

        {stop && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button onClick={() => walk.toggleVisited(stop.id)} aria-pressed={visited} className={cn("press flex h-[74px] flex-col items-start justify-between rounded-[20px] p-3 text-left text-[12.5px] font-semibold", visited ? "bg-uw-ink text-white" : "bg-uw-yellow")}>
              <Check className="size-5" /> {visited ? "Visited" : "Mark visited"}
            </button>
            <button onClick={() => walk.openComposer("observation", stop.id)} className="press flex h-[74px] flex-col items-start justify-between rounded-[20px] bg-white p-3 text-left text-[12.5px] font-semibold">
              <PenLine className="size-5" /> Observe
            </button>
            <button onClick={() => walk.openComposer("photo", stop.id)} className="press flex h-[74px] flex-col items-start justify-between rounded-[20px] bg-white p-3 text-left text-[12.5px] font-semibold">
              <Camera className="size-5" /> Photograph
            </button>
          </div>
        )}

        <Overview content={content} />

        {stop && <OrganiserSections stop={stop} />}

        {photos.length > 1 && (
          <section className="mt-9">
            <h2 className="text-[19px] font-semibold tracking-tight">Photographs</h2>
            <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scrollbar-none">
              {photos.map((p) => (
                <li key={p.page} className="w-[220px] shrink-0 snap-start">
                  <div className="h-[260px] overflow-hidden rounded-[22px] bg-uw-mist">
                    <WikiImage photo={p} sizes="220px" maxWidth={500} className="size-full" />
                  </div>
                  <Credit photo={p} className="mt-1.5 block text-uw-slate" />
                </li>
              ))}
              <li aria-hidden className="w-2 shrink-0" />
            </ul>
          </section>
        )}

        {stop && (
          <section className="mt-9">
            <h2 className="text-[19px] font-semibold tracking-tight">Look closer</h2>
            <p className="mt-1 text-[13px] text-uw-slate">Pick a question and write what you observe here.</p>
            <div className="mt-3 flex flex-col gap-2">
              {OBSERVATION_PROMPTS.slice(0, 4).map((p) => (
                <button key={p} onClick={() => walk.openComposer("observation", stop.id)} className="press flex items-center justify-between rounded-[18px] bg-white px-4 py-3.5 text-left text-[14px]">
                  {p} <ArrowRight className="size-4 shrink-0 text-uw-slate" />
                </button>
              ))}
            </div>
          </section>
        )}

        {stop && (
          <section className="mt-9">
            <h2 className="text-[19px] font-semibold tracking-tight">Participants’ observations</h2>
            {posts.length === 0 ? (
              <p className="mt-2 rounded-[18px] border border-dashed border-uw-line p-4 text-[13px] text-uw-slate">No one has posted from this stop yet.</p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">{posts.map((p) => <PostCard key={p.id} post={p} compact />)}</div>
            )}
          </section>
        )}

        {(prev || next || nearby.length > 0) && (
          <section className="mt-9">
            <h2 className="text-[19px] font-semibold tracking-tight">Related places</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {prev && <RelatedLink stop={prev} dir="prev" />}
              {next && <RelatedLink stop={next} dir="next" />}
            </div>
            {nearby.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-uw-line rounded-[18px] bg-white">
                {nearby.map((p) => (
                  <li key={p.id}>
                    <Link href={`/landmark/${p.id}`} className="flex items-center justify-between px-4 py-3 text-[14px]">
                      <span>{p.name}<span className="ml-2 text-[11px] text-uw-slate">{CATEGORY_LABEL[p.category]}</span></span>
                      <span className="tabular text-[12px] text-uw-slate">{fmtDistance(haversineM(p.coord, target.coord))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </article>
    </main>
  );
}

function Overview({ content }: { content: FetchedContent | null }) {
  const text = content?.article ?? content?.area;
  if (!text) return null;
  const isArea = !content?.article;
  return (
    <section className="mt-8">
      <h2 className="text-[19px] font-semibold tracking-tight">{isArea ? `About the area: ${text.title}` : "Overview"}</h2>
      <div className="mt-3 space-y-3 text-[15.5px] leading-[1.65] text-uw-charcoal">
        {text.paragraphs.slice(0, isArea ? 1 : 4).map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
      </div>
      <a href={text.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[12px] text-uw-slate underline underline-offset-2">
        Source: Wikipedia, “{text.title}” ({text.license}) <ExternalLink className="size-3" />
      </a>
    </section>
  );
}

function OrganiserSections({ stop }: { stop: Stop }) {
  if (stop.sections.length === 0) {
    return (
      <p className="mt-8 rounded-[18px] bg-uw-mist p-4 text-[13px] leading-relaxed text-uw-charcoal/75">
        Historical, architectural and urban-planning notes for this stop are added by the organisers once verified.
      </p>
    );
  }
  return (
    <div className="mt-2">
      {stop.sections.map((s) => (
        <section key={s.key} className="mt-8">
          <h2 className="text-[19px] font-semibold tracking-tight">{SECTION_LABELS[s.key]}</h2>
          <div className="mt-3 space-y-3 text-[15.5px] leading-[1.65] text-uw-charcoal">
            {s.body.split(/\n{2,}/).map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
          </div>
          {s.source && <p className="mt-2 text-[12px] text-uw-slate">Source: {s.source}</p>}
        </section>
      ))}
    </div>
  );
}

function RelatedLink({ stop, dir }: { stop: Stop; dir: "prev" | "next" }) {
  return (
    <Link href={`/landmark/${stop.id}`} className={cn("press flex flex-col gap-3 rounded-[20px] bg-white p-3.5", dir === "next" && "col-start-2 items-end text-right")}>
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-uw-slate">
        {dir === "prev" ? <><ArrowLeft className="size-3.5" /> Previous</> : <>Next <ArrowRight className="size-3.5" /></>}
      </span>
      <span className="flex items-center gap-2 text-[14px] font-semibold leading-tight">
        {dir === "prev" && <StopBadge n={stop.number} size="sm" />} {stop.name} {dir === "next" && <StopBadge n={stop.number} size="sm" />}
      </span>
    </Link>
  );
}
