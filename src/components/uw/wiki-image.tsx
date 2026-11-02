/* eslint-disable @next/next/no-img-element -- Wikimedia already serves sized thumbnails; next/image would re-proxy them */
import { cn } from "@/lib/utils";
import type { Photo } from "@/lib/types";

// Wikimedia only renders a fixed set of thumbnail widths.
const WIDTHS = [250, 500, 960];

export function thumb(src: string, w: number) {
  return src.includes("/thumb/") ? src.replace(/\/\d+px-/, `/${w}px-`) : src;
}

type Props = {
  photo: Photo;
  sizes: string;
  className?: string;
  priority?: boolean;
  alt?: string;
  /** cap the largest candidate, e.g. 250 for marker thumbnails */
  maxWidth?: number;
};

export function WikiImage({ photo, sizes, className, priority, alt, maxWidth = 960 }: Props) {
  const widths = WIDTHS.filter((w) => w <= Math.min(maxWidth, photo.width || 960));
  const srcSet = photo.src.includes("/thumb/") ? widths.map((w) => `${thumb(photo.src, w)} ${w}w`).join(", ") : undefined;
  return (
    <img
      src={thumb(photo.src, widths.at(-1) ?? 250)}
      srcSet={srcSet}
      sizes={sizes}
      crossOrigin="anonymous"
      alt={alt ?? photo.caption}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      width={photo.width}
      height={photo.height}
      className={cn("object-cover", className)}
    />
  );
}

export function Credit({ photo, className }: { photo: Photo; className?: string }) {
  return (
    <a href={photo.page} target="_blank" rel="noreferrer" className={cn("text-[10px] leading-tight opacity-70 hover:opacity-100", className)}>
      Photo: {photo.author || "Wikimedia Commons"} · {photo.license}
    </a>
  );
}
