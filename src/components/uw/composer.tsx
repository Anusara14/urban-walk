"use client";
/* eslint-disable @next/next/no-img-element -- local object-URL preview */

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, MapPin, MapPinOff, X } from "lucide-react";
import { Sheet } from "./sheet";
import { useEvent } from "@/components/providers/event-provider";
import { useWalk } from "@/components/providers/walk-provider";
import Link from "next/link";
import { displayName, useAuth } from "@/lib/auth";
import { haversineM, fmtDistance } from "@/lib/geo";
import { preparePhoto } from "@/lib/image";
import type { GeoTag } from "@/lib/types";
import { cn } from "@/lib/utils";

export const OBSERVATION_PROMPTS = [
  "What did you notice about this place?",
  "How did this space make you feel?",
  "How would you describe the pedestrian experience?",
  "Who is using this space, and how?",
  "What is the street's character here?",
  "How comfortable is it — shade, noise, heat, seating?",
];

/** How far a geotag may be from a stop before we stop suggesting it. */
const SUGGEST_RADIUS_M = 120;

export function Composer() {
  const { composer, closeComposer } = useWalk();
  return (
    <Sheet open={!!composer} onClose={closeComposer} label={composer?.kind === "photo" ? "Capture a photo" : "Write an observation"}>
      {composer && <ComposerBody key={`${composer.kind}-${composer.landmarkId}`} />}
    </Sheet>
  );
}

function ComposerBody() {
  const { model } = useEvent();
  const { composer, closeComposer, createPost, geo, startLocation } = useWalk();
  const kind = composer!.kind;
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState(kind === "observation" ? OBSERVATION_PROMPTS[0] : undefined);
  const [attachGeo, setAttachGeo] = useState(true);
  const [chosenLandmark, setLandmark] = useState<string | null>(composer!.landmarkId);
  const [landmarkTouched, setLandmarkTouched] = useState(!!composer!.landmarkId);
  const { account } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Geotag = the participant's live position while composing.
  const geoTag: GeoTag = useMemo(
    () => (geo.status === "active" ? { lat: geo.lat, lng: geo.lng, accuracy: Math.round(geo.accuracy) } : null),
    [geo],
  );

  const suggestion = useMemo(() => {
    if (!geoTag) return null;
    const ranked = model.stops
      .map((s) => ({ s, d: haversineM([geoTag.lng, geoTag.lat], s.coord) }))
      .sort((a, b) => a.d - b.d)[0];
    return ranked && ranked.d <= SUGGEST_RADIUS_M ? ranked : null;
  }, [geoTag, model.stops]);

  // Suggest, never force: the suggestion applies only until the user picks.
  const landmark = landmarkTouched ? chosenLandmark : (suggestion?.s.id ?? chosenLandmark);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      const blob = await preparePhoto(f);
      setFile(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that photo.");
    }
  };

  const canPublish = !busy && (kind === "photo" ? !!file : text.trim().length >= 3);
  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      await createPost({
        kind,
        landmark_id: landmark,
        text: text.trim().slice(0, 2000),
        image: file,
        geo: attachGeo ? geoTag : null,
        prompt: kind === "observation" ? prompt : undefined,
      });
      closeComposer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publishing failed. Your text is still here — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-2">
      <header className="flex items-end justify-between pt-1">
        <div>
          <p className="eyebrow text-uw-slate">{kind === "photo" ? "Document" : "Reflect"}</p>
          <h2 className="display mt-1 text-[34px]">{kind === "photo" ? "Capture" : "Observation"}</h2>
        </div>
        <button onClick={closeComposer} className="press focus-ring grid size-10 place-items-center rounded-full bg-uw-mist" aria-label="Close">
          <X className="size-5" />
        </button>
      </header>

      {kind === "observation" && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 scrollbar-none" role="listbox" aria-label="Prompts">
          {OBSERVATION_PROMPTS.map((p) => (
            <button
              key={p}
              role="option"
              aria-selected={p === prompt}
              onClick={() => setPrompt(p)}
              className={cn(
                "press shrink-0 rounded-full border px-3.5 py-2 text-[13px]",
                p === prompt ? "border-uw-ink bg-uw-ink text-white" : "border-uw-line bg-white text-uw-charcoal",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* photo */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      {preview ? (
        <div className="relative overflow-hidden rounded-card bg-uw-mist">
          <img src={preview} alt="Your photo" className="max-h-[42dvh] w-full object-cover" />
          <button
            onClick={() => { setFile(null); setPreview(null); }}
            className="press glass-dark absolute right-3 top-3 grid size-9 place-items-center rounded-full"
            aria-label="Remove photo"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div className={cn("grid gap-2", kind === "photo" ? "grid-cols-2" : "grid-cols-2")}>
          <button onClick={() => camRef.current?.click()} className={cn("press focus-ring flex flex-col items-start gap-6 rounded-card p-4 text-left", kind === "photo" ? "bg-uw-yellow" : "bg-white")}>
            <Camera className="size-6" strokeWidth={1.75} />
            <span className="text-sm font-semibold">{kind === "photo" ? "Take photo" : "Attach photo"}</span>
          </button>
          <button onClick={() => galRef.current?.click()} className="press focus-ring flex flex-col items-start gap-6 rounded-card bg-white p-4 text-left">
            <ImagePlus className="size-6" strokeWidth={1.75} />
            <span className="text-sm font-semibold">From gallery</span>
          </button>
        </div>
      )}

      <label className="block">
        <span className="eyebrow text-uw-slate">{kind === "photo" ? "Caption" : prompt}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={kind === "photo" ? 2 : 5}
          placeholder={kind === "photo" ? "What are we looking at?" : "Describe what you saw, heard and felt…"}
          className="mt-2 w-full resize-none rounded-card border border-uw-line bg-white p-4 text-[15px] leading-relaxed outline-none focus:border-uw-ink"
        />
      </label>

      {/* landmark association */}
      <div>
        <span className="eyebrow text-uw-slate">Linked stop</span>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={landmark ?? ""}
            onChange={(e) => { setLandmark(e.target.value || null); setLandmarkTouched(true); }}
            className="h-11 flex-1 rounded-full border border-uw-line bg-white px-4 text-[14px] outline-none focus:border-uw-ink"
          >
            <option value="">Not linked to a stop</option>
            {model.stops.map((s) => (
              <option key={s.id} value={s.id}>{String(s.number).padStart(2, "0")} · {s.name}</option>
            ))}
          </select>
        </div>
        {suggestion && !landmarkTouched && (
          <p className="mt-1.5 text-xs text-uw-slate">Suggested because you’re {fmtDistance(suggestion.d)} from {suggestion.s.name}. Change or clear it if it’s not about this stop.</p>
        )}
      </div>

      {/* location privacy */}
      <div className="flex items-center gap-3 rounded-card bg-white p-3.5">
        <div className={cn("grid size-9 place-items-center rounded-full", attachGeo && geoTag ? "bg-uw-yellow" : "bg-uw-mist")}>
          {attachGeo ? <MapPin className="size-4" /> : <MapPinOff className="size-4" />}
        </div>
        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          {geoTag ? (
            <>
              <p className="font-medium">{attachGeo ? "Location will be attached" : "Location removed"}</p>
              <p className="text-uw-slate">
                {attachGeo ? `Where you are now, ±${geoTag.accuracy ?? "?"} m. Shown on the map with this post.` : "The post will have no coordinates."}
              </p>
            </>
          ) : geo.status === "denied" || geo.status === "unsupported" ? (
            <p className="text-uw-slate">Location is off, so this post won’t be placed on the map.</p>
          ) : (
            <button onClick={startLocation} className="font-medium underline underline-offset-2">
              {geo.status === "requesting" ? "Finding your location…" : "Add my current location"}
            </button>
          )}
        </div>
        {geoTag && (
          <button
            role="switch"
            aria-checked={attachGeo}
            aria-label="Attach location"
            onClick={() => setAttachGeo((v) => !v)}
            className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", attachGeo ? "bg-uw-ink" : "bg-uw-line")}
          >
            <span className={cn("absolute top-1 size-5 rounded-full bg-white transition-transform", attachGeo ? "translate-x-6" : "translate-x-1")} />
          </button>
        )}
      </div>

      <p className="text-[12.5px] text-uw-slate">
        Posting as <span className="font-semibold text-uw-ink">{displayName(account)}</span> ·{" "}
        <Link href="/login" onClick={closeComposer} className="underline underline-offset-2">change</Link>
      </p>

      {error && <p role="alert" className="rounded-card bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        disabled={!canPublish}
        onClick={publish}
        className="press focus-ring flex h-14 items-center justify-center gap-2 rounded-full bg-uw-ink text-[15px] font-semibold text-white disabled:opacity-35"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Publish to Discoveries
      </button>
    </div>
  );
}
