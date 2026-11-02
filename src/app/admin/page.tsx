"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpenText, CalendarCog, Download, LayoutDashboard, MapPinned, Route, ShieldCheck, Shapes, Upload, Undo2 } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { ContentTab, EventTab, FeaturesTab, SegmentsTab, StopsTab } from "@/components/admin/editors";
import { Moderation } from "@/components/admin/moderation";
import { Overview } from "@/components/admin/overview";
import { AccountButton } from "@/components/uw/account-button";
import { Wordmark } from "@/components/uw/brand";
import { MadeBy } from "@/components/uw/made-by";
import { adminTestAccess, useAuth } from "@/lib/auth";
import { backendMode } from "@/lib/supabase";
import type { EventConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, blurb: "Live participation across the walk" },
  { id: "moderation", label: "Moderation", icon: ShieldCheck, blurb: "Review and remove participant posts" },
  { id: "event", label: "Event", icon: CalendarCog, blurb: "Title, date, description and pacing" },
  { id: "stops", label: "Stops", icon: MapPinned, blurb: "Which KML points are stops, their names and alert radii" },
  { id: "content", label: "Content", icon: BookOpenText, blurb: "Verified notes for each stop, each with a source" },
  { id: "segments", label: "Segments", icon: Route, blurb: "The six segments, as distances along the original route" },
  { id: "features", label: "Features", icon: Shapes, blurb: "Category of every feature in the KML" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
const isSection = (v: string): v is SectionId => SECTIONS.some((s) => s.id === v);

/** Organisers only: Supabase app_metadata.role = "organiser"; any local profile in dev mode. */
export default function AdminPage() {
  const { ready, account } = useAuth();
  if (!ready) return <main className="grid min-h-dvh place-items-center bg-uw-paper text-uw-slate">Checking access…</main>;
  const testMode = !account?.organiser && adminTestAccess;
  if (!account?.organiser && !testMode) {
    return (
      <main className="grid min-h-dvh place-items-center bg-uw-paper p-8 text-center">
        <div className="max-w-sm">
          <Wordmark className="mx-auto w-40 text-uw-ink" />
          <h1 className="display mt-5 text-[34px]">Organisers only</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-uw-slate">
            {account ? "Your account isn’t an organiser account. Ask the event team to grant access." : "Sign in with an organiser account to manage this event."}
          </p>
          <Link href="/login?next=/admin" className="press mt-6 inline-flex h-12 items-center rounded-full bg-uw-ink px-6 text-[14px] font-semibold text-white">
            {account ? "Switch account" : "Sign in"}
          </Link>
        </div>
      </main>
    );
  }
  return <AdminConsole testMode={testMode} />;
}

/**
 * Organiser console. Edits are a patch over public/data/event.json, kept in this
 * browser; "Export event.json" downloads the merged file to publish.
 * Desktop: dark sidebar + wide content. Phone: sticky top bar + scrollable section tabs.
 */
function AdminConsole({ testMode }: { testMode: boolean }) {
  const { base, model, override, saveOverride, resetOverride } = useEvent();
  const [section, setSection] = useState<SectionId>("overview");
  const cfg: EventConfig = { ...base.event, ...override };
  const patch = (p: Partial<EventConfig>) => saveOverride({ ...override, ...p });
  const drafts = Object.keys(override).length > 0;
  const current = SECTIONS.find((s) => s.id === section)!;

  // #section deep links, so a refresh keeps you where you were
  useEffect(() => {
    const sync = () => {
      const h = location.hash.slice(1);
      if (isSection(h)) setSection(h);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const go = (id: SectionId) => {
    setSection(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2) + "\n"], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "event.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as Partial<EventConfig>;
      if (typeof parsed !== "object" || !Array.isArray(parsed.stops)) throw new Error("Not an Urban Walk event.json");
      if (parsed.id && parsed.id !== base.event.id) throw new Error(`This file is for event "${parsed.id}", not "${base.event.id}".`);
      saveOverride(parsed);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div className="min-h-dvh bg-uw-paper lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-uw-ink px-4 py-6 text-white lg:flex">
        <Link href="/" className="px-2" aria-label="Open the app"><Wordmark className="w-[150px] text-white" /></Link>
        <p className="eyebrow mt-3 px-2 text-white/45">Organiser console</p>
        <nav className="mt-8 grid gap-1" aria-label="Admin sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-[14px] px-3 text-left text-[14px] font-medium transition-colors",
                section === id ? "bg-uw-yellow text-uw-ink" : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.75} /> {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 px-2">
          <p className="text-[12px] leading-snug text-white/50">{cfg.title} · {model.stops.length} stops · {(model.lengthM / 1000).toFixed(1)} km</p>
          <div className="flex items-center justify-between">
            <AccountButton tone="dark" />
            <Link href="/" className="flex items-center gap-1 text-[13px] text-white/70 hover:text-white">Open app <ArrowUpRight className="size-3.5" /></Link>
          </div>
          <MadeBy tone="dark" className="border-t border-white/10 pt-3" />
        </div>
      </aside>

      <div className="min-w-0">
        {/* phone / tablet top bar */}
        <header className="sticky top-0 z-30 border-b border-uw-mist bg-uw-paper/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
            <Link href="/" aria-label="Open the app"><Wordmark className="w-[118px] text-uw-ink" /></Link>
            <AccountButton />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5 scrollbar-none" aria-label="Admin sections">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => go(id)}
                aria-current={section === id ? "page" : undefined}
                className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium", section === id ? "bg-uw-ink text-white" : "bg-white text-uw-charcoal")}
              >
                <Icon className="size-4" strokeWidth={1.75} /> {label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          {testMode && (
            <p role="note" className="mb-6 rounded-[16px] border border-uw-yellow-deep bg-uw-yellow/40 px-4 py-3 text-[13px] leading-relaxed text-uw-ink">
              <strong className="font-semibold">Test mode.</strong> You&apos;re seeing the dashboard without an organiser account because this is{" "}
              {backendMode === "local" ? "running without Supabase" : "a development build"}. A deployed event with Supabase requires an organiser sign-in
              {backendMode === "supabase" && "; deleting other people's posts still needs the organiser role"}.
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow text-uw-slate">{cfg.kicker}</p>
              <h1 className="display mt-2 text-[38px] sm:text-[46px]">{current.label}</h1>
              <p className="mt-2 text-[13.5px] text-uw-slate">{current.blurb}</p>
            </div>
            {/* publishing actions: edits are local drafts until exported */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-3 py-1.5 text-[12px] font-semibold", drafts ? "bg-uw-yellow text-uw-ink" : "bg-white text-uw-slate")}>
                {drafts ? "Unpublished drafts" : "Published config"}
              </span>
              <label className="press flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium shadow-sm">
                <Upload className="size-4" /> Import
                <input type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
              </label>
              <button onClick={exportJson} className="press flex h-10 items-center gap-2 rounded-full bg-uw-ink px-4 text-[13px] font-medium text-white">
                <Download className="size-4" /> Export event.json
              </button>
              {drafts && (
                <button onClick={() => confirm("Discard all unpublished edits?") && resetOverride()} className="press flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] shadow-sm" aria-label="Discard drafts">
                  <Undo2 className="size-4" /> Discard
                </button>
              )}
            </div>
          </div>

          <div className="mt-7">
            {section === "overview" && <Overview onOpenModeration={() => go("moderation")} />}
            {section === "moderation" && <Moderation />}
            {section === "event" && <Narrow><EventTab cfg={cfg} patch={patch} /></Narrow>}
            {section === "stops" && <Narrow><StopsTab cfg={cfg} patch={patch} /></Narrow>}
            {section === "content" && <Narrow><ContentTab cfg={cfg} patch={patch} /></Narrow>}
            {section === "segments" && (
              <SegmentsTab cfg={cfg} patch={patch} lengthKm={model.lengthM / 1000} line={model.line} stops={model.stops.map((s) => ({ n: s.number, km: s.routeKm }))} />
            )}
            {section === "features" && <FeaturesTab cfg={cfg} patch={patch} />}
          </div>
          <MadeBy className="mt-12 justify-center border-t border-uw-mist pt-5 lg:hidden" />
        </main>
      </div>
    </div>
  );
}

/** Forms read best at a comfortable line length even on wide screens. */
const Narrow = ({ children }: { children: React.ReactNode }) => <div className="max-w-3xl">{children}</div>;
