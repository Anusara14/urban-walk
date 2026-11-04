import { cn } from "@/lib/utils";

type Props = { n: number; className?: string; visited?: boolean; size?: "sm" | "md" };

/** The orange numbered dot; green once visited. */
export function StopBadge({ n, className, visited, size = "md" }: Props) {
  return (
    <span
      className={cn(
        "tabular grid place-items-center rounded-full font-semibold leading-none ring-2 ring-white",
        size === "sm" ? "size-5 text-[10px]" : "size-6 text-[11px]",
        visited ? "bg-uw-green text-uw-on-accent" : "bg-uw-orange text-uw-on-accent",
        className,
      )}
    >
      {n}
    </span>
  );
}
