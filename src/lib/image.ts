"use client";

/** Full photo for the detail view, and a small one for feeds and map markers (~30–50 KB). */
export type PreparedPhoto = { full: Blob; thumb: Blob };

const FULL_EDGE = 1600;
const THUMB_EDGE = 480;

/**
 * Downscale + re-encode a captured photo. Re-encoding through a canvas also
 * drops all EXIF metadata (including the camera's own GPS tag), so the only
 * location stored is the one the participant explicitly chose to attach.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const [full, thumb] = [await encode(bitmap, FULL_EDGE, 0.82), await encode(bitmap, THUMB_EDGE, 0.72)];
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}

async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  // Safari < 17 can't encode WebP and silently returns PNG; fall back to JPEG then.
  const webp = await toBlob("image/webp");
  const blob = webp?.type === "image/webp" ? webp : await toBlob("image/jpeg");
  if (!blob) throw new Error("Couldn't process this photo.");
  return blob;
}
