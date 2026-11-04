"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { Stop } from "@/lib/types";
import { settleAfter } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

/** The big two-line place name from the references ("Big / Ben"), re-set per stop. */
export function TitleBlock({ stop, isNext, onClick }: { stop: Stop; isNext: boolean; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useGSAP(
    () => {
      return settleAfter(gsap.fromTo(".tb-line", { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "expo.out", stagger: 0.06 }));
    },
    { scope: ref, dependencies: [stop.id], revertOnUpdate: true },
  );
  const words = stop.name.split(" ");
  const half = Math.ceil(words.length / 2);
  const lines = words.length > 1 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [stop.name];
  return (
    <button ref={ref} onClick={onClick} className="max-w-[min(62vw,360px)] text-left focus-visible:outline-none" aria-label={`${isNext ? "Next stop" : "Selected stop"}: ${stop.name}`}>
      <p className="tb-line eyebrow text-on-map mb-2 flex items-center gap-2 text-uw-charcoal">
        <span className="tabular grid size-5 place-items-center rounded-full bg-uw-orange text-[10px] text-uw-on-accent">{stop.number}</span>
        {isNext ? "Next stop" : "Stop"}
      </p>
      <h1 className="display text-on-map text-[clamp(32px,11vw,56px)] text-uw-ink [@media(max-height:560px)]:text-[28px]">
        {lines.map((l) => (
          <span key={l} className="tb-line block overflow-hidden pb-[0.06em]">{l}</span>
        ))}
      </h1>
      <p className="tb-line text-on-map mt-2 text-[13px] font-medium text-uw-charcoal">{stop.area}, Colombo</p>
    </button>
  );
}
