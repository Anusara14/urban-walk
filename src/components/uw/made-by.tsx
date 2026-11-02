import { cn } from "@/lib/utils";
import { CodemypageLogo } from "./codemypage-logo";

const CODEMYPAGE_URL = "https://codemypage.com";
const GITHUB_URL = "https://github.com/Anusara14";

/** "Developed by Codemypage · Anusara14" credit. `tone` matches the surface it sits on. */
export function MadeBy({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const muted = tone === "dark" ? "text-white/55" : "text-uw-slate";
  const strong = tone === "dark" ? "text-white hover:text-uw-yellow" : "text-uw-ink hover:text-uw-charcoal";
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]", muted, className)}>
      <span>Developed by</span>
      <a href={CODEMYPAGE_URL} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center transition-colors", strong)} aria-label="Codemypage (opens codemypage.com)">
        <CodemypageLogo className="w-[84px]" title="Codemypage" />
      </a>
      <span aria-hidden>·</span>
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={cn("font-semibold underline-offset-2 transition-colors hover:underline", strong)}>
        Anusara14
      </a>
    </p>
  );
}
