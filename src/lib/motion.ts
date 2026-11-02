import type gsap from "gsap";

/**
 * GSAP advances on requestAnimationFrame. If rAF stalls (battery saver,
 * background tab, headless capture) an intro would leave content at opacity 0,
 * so snap it to the end state on a plain timer. Returns a cleanup.
 */
export function settleAfter(anim: gsap.core.Animation, ms = 1600) {
  const t = setTimeout(() => anim.progress(1), ms);
  return () => clearTimeout(t);
}
