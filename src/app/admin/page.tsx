"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { useEvent } from "@/components/providers/event-provider";
import { Wordmark } from "@/components/uw/brand";
import { useAuth } from "@/lib/auth";
import { CATEGORY_LABEL } from "@/lib/event-model";
import { bounds } from "@/lib/geo";
import { SECTION_LABELS, type Category, type EventConfig, type SectionKey, type SegmentConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Event", "Stops", "Content", "Segments", "Features"] as const;
type Tab = (typeof TABS)[number];
const EDITABLE_CATEGORIES: Category[] = ["official_landmark", "supporting_location", "rest_area", "public_facility", "starting_point", "ending_point"];

/**
 * Organiser console. Edits are a patch over public/data/event.json, kept in this
 * browser in development. "Export" downloads the merged event.json to publish
 * (replace the file, or store it in Supabase `events.config`).
 */
/** Organisers only: Supabase app_metadata.role = "organiser"; any local profile in dev mode. */
export default function AdminPage() {
  const { ready, account } = useAuth();
  if (!ready) return <main className="grid min-h-dvh place-items-center text-uw-slate">Checking access…</main>;
  if (!account?.organiser) {
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
  return <AdminConsole />;
}

function AdminConsole() {
  const { base, model, override, saveOverride, resetOverride } = useEvent();
  const [tab, setTab] = useState<Tab>("Event");
  const cfg: EventConfig = { ...base.event, ...override };
  const patch = (p: Partial<EventConfig>) => saveOverride({ ...override, ...p });

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
    <main className="mx-auto min-h-dvh max-w-3xl bg-uw-paper px-5 pb-20 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-uw-slate">Organiser console · {cfg.id}</p>
          <h1 className="display mt-2 text-[44px]">Event admin</h1>
          <p className="mt-2 text-[13px] text-uw-slate">
            {Object.keys(override).length ? "Unpublished changes saved in this browser." : "Showing the published configuration."}{" "}
            <Link href="/" className="underline">Open app</Link>
          </p>
        </div>
        <div className="flex gap-2">
          <label className="press flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium">
            <Upload className="size-4" /> Import
            <input type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
          </label>
          <button onClick={exportJson} className="press flex h-10 items-center gap-2 rounded-full bg-uw-ink px-4 text-[13px] font-medium text-white">
            <Download className="size-4" /> Export event.json
          </button>
          <button onClick={() => confirm("Discard all local edits?") && resetOverride()} className="press grid size-10 place-items-center rounded-full bg-white" aria-label="Discard local edits">
            <RotateCcw className="size-4" />
          </button>
        </div>
      </header>

      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-full bg-white p-1 scrollbar-none" aria-label="Admin sections">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined} className={cn("h-9 shrink-0 rounded-full px-4 text-[13px] font-medium", tab === t && "bg-uw-ink text-white")}>
            {t}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "Event" && <EventTab cfg={cfg} patch={patch} />}
        {tab === "Stops" && <StopsTab cfg={cfg} patch={patch} />}
        {tab === "Content" && <ContentTab cfg={cfg} patch={patch} />}
        {tab === "Segments" && <SegmentsTab cfg={cfg} patch={patch} lengthKm={model.lengthM / 1000} line={model.line} stops={model.stops.map((s) => ({ n: s.number, km: s.routeKm }))} />}
        {tab === "Features" && <FeaturesTab cfg={cfg} patch={patch} />}
      </div>
    </main>
  );
}

type TabProps = { cfg: EventConfig; patch: (p: Partial<EventConfig>) => void };

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="eyebrow text-uw-slate">{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint && <span className="mt-1 block text-[11.5px] text-uw-slate">{hint}</span>}
  </label>
);
const input = "h-11 w-full rounded-[14px] border border-uw-line bg-white px-3.5 text-[14px] outline-none focus:border-uw-ink";

function EventTab({ cfg, patch }: TabProps) {
  const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
  return (
    <div className="grid gap-4">
      <Field label="Title"><input className={input} value={cfg.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
      <Field label="Kicker"><input className={input} value={cfg.kicker} onChange={(e) => patch({ kicker: e.target.value })} /></Field>
      <Field label="Location"><input className={input} value={cfg.location} onChange={(e) => patch({ location: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts"><input type="datetime-local" className={input} value={toLocal(cfg.start_date)} onChange={(e) => patch({ start_date: e.target.value || null })} /></Field>
        <Field label="Ends"><input type="datetime-local" className={input} value={toLocal(cfg.end_date)} onChange={(e) => patch({ end_date: e.target.value || null })} /></Field>
      </div>
      <Field label="Description"><textarea rows={4} className={cn(input, "h-auto py-3")} value={cfg.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Walking speed (km/h)"><input type="number" step="0.1" min="2" max="7" className={input} value={cfg.walking_speed_kmh} onChange={(e) => patch({ walking_speed_kmh: Number(e.target.value) || 4.5 })} /></Field>
        <Field label="Minutes per stop"><input type="number" min="0" max="60" className={input} value={cfg.dwell_minutes_per_stop} onChange={(e) => patch({ dwell_minutes_per_stop: Number(e.target.value) || 0 })} /></Field>
        <Field label="3D corridor (m)" hint="Buildings this close to the route are extruded."><input type="number" min="30" max="500" className={input} value={cfg.corridor_m} onChange={(e) => patch({ corridor_m: Number(e.target.value) || 150 })} /></Field>
      </div>
    </div>
  );
}

function StopsTab({ cfg, patch }: TabProps) {
  const { base } = useEvent();
  const byId = new Map(base.landmarks.features.map((f) => [f.properties.id, f.properties]));
  const update = (i: number, p: Partial<EventConfig["stops"][number]>) => patch({ stops: cfg.stops.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const candidates = base.landmarks.features.filter((f) => !cfg.stops.some((s) => s.feature_id === f.properties.id));
  return (
    <div className="grid gap-3">
      <p className="text-[13px] text-uw-slate">Stops are numbered by their position along the KML route, not by this list order.</p>
      {cfg.stops.map((s, i) => (
        <div key={s.feature_id} className="grid grid-cols-[1fr_120px_90px_40px] items-end gap-2 rounded-[18px] bg-white p-3">
          <Field label={`KML: ${byId.get(s.feature_id)?.name ?? s.feature_id}`}><input className={input} value={s.display_name} onChange={(e) => update(i, { display_name: e.target.value })} /></Field>
          <Field label="Area"><input className={input} value={s.area ?? ""} onChange={(e) => update(i, { area: e.target.value })} /></Field>
          <Field label="Radius m"><input type="number" min="10" max="300" className={input} value={s.proximity_m ?? cfg.default_proximity_m} onChange={(e) => update(i, { proximity_m: Number(e.target.value) || undefined })} /></Field>
          <button onClick={() => patch({ stops: cfg.stops.filter((_, j) => j !== i) })} aria-label="Remove stop" className="grid h-11 place-items-center rounded-[14px] bg-uw-mist"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <select
        value=""
        onChange={(e) => {
          const f = byId.get(e.target.value);
          if (f) patch({ stops: [...cfg.stops, { feature_id: f.id, display_name: f.name }] });
        }}
        className={input}
      >
        <option value="">+ Add a KML point as a stop…</option>
        {candidates.map((f) => <option key={f.properties.id} value={f.properties.id}>{f.properties.name} ({f.properties.source_folder})</option>)}
      </select>
    </div>
  );
}

function ContentTab({ cfg, patch }: TabProps) {
  const { model } = useEvent();
  const [stopId, setStopId] = useState(model.stops[0]?.id ?? "");
  const sections = cfg.sections[stopId] ?? [];
  const set = (next: typeof sections) => patch({ sections: { ...cfg.sections, [stopId]: next } });
  const used = new Set(sections.map((s) => s.key));
  const free = (Object.keys(SECTION_LABELS) as SectionKey[]).filter((k) => !used.has(k));
  return (
    <div className="grid gap-4">
      <p className="rounded-[16px] bg-uw-yellow/40 p-3 text-[13px] leading-relaxed">
        Only add verified information, and cite a source for each section. The overview shown in the app comes from Wikipedia with attribution.
      </p>
      <select value={stopId} onChange={(e) => setStopId(e.target.value)} className={input}>
        {model.stops.map((s) => <option key={s.id} value={s.id}>{s.number}. {s.name}</option>)}
      </select>
      {sections.map((s, i) => (
        <div key={s.key} className="grid gap-2 rounded-[18px] bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold">{SECTION_LABELS[s.key]}</span>
            <button onClick={() => set(sections.filter((_, j) => j !== i))} aria-label="Remove section" className="text-uw-slate"><Trash2 className="size-4" /></button>
          </div>
          <textarea rows={5} className={cn(input, "h-auto py-3")} value={s.body} onChange={(e) => set(sections.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} placeholder="Blank line = new paragraph" />
          <input className={input} value={s.source ?? ""} onChange={(e) => set(sections.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))} placeholder="Source (book, URL, archive reference) — required" />
          {!s.source?.trim() && <span className="text-[11.5px] text-red-700">Add a source before publishing.</span>}
        </div>
      ))}
      {free.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {free.map((k) => (
            <button key={k} onClick={() => set([...sections, { key: k, body: "" }])} className="press flex h-9 items-center gap-1 rounded-full bg-white px-3 text-[12.5px]">
              <Plus className="size-3.5" /> {SECTION_LABELS[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SEG_COLORS = ["#ffe500", "#141518", "#7b8796", "#f2a900", "#4b5563", "#c7d3dc", "#a16207", "#1f2937"];

function SegmentsTab({ cfg, patch, lengthKm, line, stops }: TabProps & { lengthKm: number; line: [number, number][]; stops: { n: number; km: number }[] }) {
  const segs = cfg.segments;
  const round = (v: number) => Math.round(v * 1000) / 1000;
  // Boundaries are shared, so segments always connect end-to-start.
  const cuts = segs.length ? [segs[0].start_km, ...segs.map((s) => s.end_km)] : [];
  const fromCuts = (c: number[], names = segs.map((s) => s.name)): SegmentConfig[] =>
    c.slice(0, -1).map((start, i) => ({ id: `seg-${i + 1}`, name: names[i] ?? `Segment ${i + 1}`, start_km: round(start), end_km: round(c[i + 1]) }));
  const create = (n: number) => patch({ segments: fromCuts(Array.from({ length: n + 1 }, (_, i) => (lengthKm * i) / n), []) });
  const moveCut = (i: number, km: number) => {
    const c = [...cuts];
    c[i] = Math.min(Math.max(km, c[i - 1] + 0.01), c[i + 1] - 0.01);
    patch({ segments: fromCuts(c) });
  };

  // tiny SVG preview of the KML line coloured by segment
  const [[minX, minY], [maxX, maxY]] = useMemo(() => bounds(line), [line]);
  const W = 320, H = 360;
  const s = Math.min(W / (maxX - minX), H / (maxY - minY)) * 0.9;
  const px = (p: [number, number]) => `${(p[0] - minX) * s + 10},${H - (p[1] - minY) * s}`;
  const cum = useMemo(() => {
    const out = [0];
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [line[i - 1], line[i]];
      out.push(out[i - 1] + Math.hypot((b[0] - a[0]) * 110.4 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110.6));
    }
    return out;
  }, [line]);
  const colourAt = (km: number) => {
    const i = segs.findIndex((g) => km >= g.start_km && km <= g.end_km);
    return i < 0 ? "#d5d9de" : SEG_COLORS[i % SEG_COLORS.length];
  };

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-3">
        <p className="text-[13px] leading-relaxed text-uw-slate">
          The KML has a single route line; the source map only says “Covers 06 Segments”. Define boundaries as distances along the original line —
          the geometry itself is never changed. Total length {lengthKm.toFixed(2)} km.
        </p>
        {segs.length === 0 ? (
          <div className="flex gap-2">
            <button onClick={() => create(6)} className="press h-11 rounded-full bg-uw-ink px-5 text-[13px] font-semibold text-white">Create 6 equal segments</button>
            <button onClick={() => create(Number(prompt("How many segments?", "6")) || 6)} className="press h-11 rounded-full bg-white px-5 text-[13px]">Other count…</button>
          </div>
        ) : (
          <>
            {segs.map((g, i) => (
              <div key={g.id} className="grid gap-2 rounded-[18px] bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: SEG_COLORS[i % SEG_COLORS.length] }} />
                  <input className={cn(input, "h-9")} value={g.name} onChange={(e) => patch({ segments: segs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                </div>
                <p className="tabular text-[12px] text-uw-slate">
                  {g.start_km.toFixed(2)} → {g.end_km.toFixed(2)} km · stops {stops.filter((st) => st.km >= g.start_km && st.km <= g.end_km).map((st) => st.n).join(", ") || "none"}
                </p>
                {i < segs.length - 1 && (
                  <label className="text-[12px]">
                    End boundary
                    <input type="range" min={0} max={lengthKm} step={0.005} value={g.end_km} onChange={(e) => moveCut(i + 1, Number(e.target.value))} className="w-full accent-[#141518]" />
                  </label>
                )}
              </div>
            ))}
            <button onClick={() => patch({ segments: [] })} className="press h-10 justify-self-start rounded-full bg-white px-4 text-[13px]">Remove segments</button>
          </>
        )}
      </div>
      <svg viewBox={`0 0 ${W + 20} ${H + 10}`} className="w-full rounded-[22px] bg-white" role="img" aria-label="Route preview coloured by segment">
        {line.slice(1).map((p, i) => (
          <line key={i} x1={px(line[i]).split(",")[0]} y1={px(line[i]).split(",")[1]} x2={px(p).split(",")[0]} y2={px(p).split(",")[1]} stroke={colourAt((cum[i] + cum[i + 1]) / 2)} strokeWidth={6} strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
}

function FeaturesTab({ cfg, patch }: TabProps) {
  const { base } = useEvent();
  const all = [...base.landmarks.features, ...base.facilities.features, ...base.restAreas.features];
  return (
    <div className="overflow-hidden rounded-[18px] bg-white">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-uw-mist text-[11px] uppercase tracking-wider text-uw-slate">
          <tr><th className="p-3">KML feature</th><th className="p-3">Folder</th><th className="p-3">Category</th></tr>
        </thead>
        <tbody>
          {all.map((f) => {
            const id = f.properties.id;
            const value = cfg.category_overrides[id] ?? f.properties.category;
            return (
              <tr key={id} className="border-t border-uw-mist">
                <td className="p-3">{f.properties.name}</td>
                <td className="p-3 text-uw-slate">{f.properties.source_folder}</td>
                <td className="p-2">
                  <select
                    value={value}
                    onChange={(e) => {
                      const next = { ...cfg.category_overrides };
                      if (e.target.value === f.properties.category) delete next[id];
                      else next[id] = e.target.value as Category;
                      patch({ category_overrides: next });
                    }}
                    className="h-9 rounded-[10px] border border-uw-line px-2"
                  >
                    {EDITABLE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
