import { cn } from "@/lib/utils";

type Props = { n: number; className?: string; visited?: boolean; size?: "sm" | "md" };

/** The yellow numbered dot from the references; charcoal once visited. */
export function StopBadge({ n, className, visited, size = "md" }: Props) {
  return (
    <span
      className={cn(
        "tabular grid place-items-center rounded-full font-semibold leading-none ring-2 ring-white",
        size === "sm" ? "size-5 text-[10px]" : "size-6 text-[11px]",
        visited ? "bg-uw-ink text-white" : "bg-uw-yellow text-uw-ink",
        className,
      )}
    >
      {n}
    </span>
  );
}
