"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { settleAfter } from "@/lib/motion";

gsap.registerPlugin(useGSAP);

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  className?: string;
};

/**
 * Bottom sheet. GSAP drives enter/exit and the drag-to-dismiss release;
 * the drag itself writes transform directly (no React state per frame).
 */
export function Sheet({ open, onClose, children, label, className }: SheetProps) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const drag = useRef<{ y0: number; dy: number } | null>(null);

  // mount as soon as it opens; unmount only after the exit tween
  if (open && !mounted) setMounted(true);

  const { contextSafe } = useGSAP(
    () => {
      if (!mounted || !panel.current) return;
      if (open) {
        const tl = gsap.timeline()
          .fromTo(".sheet-scrim", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, 0)
          .fromTo(panel.current, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: "expo.out" }, 0);
        return settleAfter(tl, 900);
      }
      const tl = gsap.timeline({ onComplete: () => setMounted(false) })
        .to(".sheet-scrim", { autoAlpha: 0, duration: 0.2 }, 0)
        .to(panel.current, { yPercent: 100, duration: 0.3, ease: "power2.in" }, 0);
      return settleAfter(tl, 700);
    },
    { scope: root, dependencies: [open, mounted] },
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y0: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y0);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  // eslint-disable-next-line react-hooks/refs -- contextSafe wraps the handler; refs are read on pointerup, not during render
  const onPointerUp = contextSafe(() => {
    if (!drag.current || !panel.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (dy > 110) onClose();
    else gsap.to(panel.current, { y: 0, duration: 0.35, ease: "expo.out", clearProps: "transform" });
  });

  if (!mounted) return null;
  return (
    <div ref={root} className="fixed inset-0 z-50 flex justify-center" role="dialog" aria-modal="true" aria-label={label}>
      <button aria-label="Close" onClick={onClose} className="sheet-scrim absolute inset-0 bg-uw-night/40 opacity-0" />
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          "outline-none",
          "absolute bottom-0 w-full max-w-[440px] sm:max-w-[560px] rounded-t-sheet bg-uw-paper shadow-[var(--shadow-soft)] will-change-transform",
          "max-h-[92dvh] flex flex-col",
          className,
        )}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-3"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="h-1.5 w-10 rounded-full bg-uw-line" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),20px)]">{children}</div>
      </div>
    </div>
  );
}
