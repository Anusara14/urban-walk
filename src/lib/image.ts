"use client";

/**
 * Downscale + re-encode a captured photo. Re-encoding through a canvas also
 * drops all EXIF metadata (including the camera's own GPS tag), so the only
 * location stored is the one the participant explicitly chose to attach.
 */
export async function preparePhoto(file: File, maxEdge = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.82));
  // Safari < 17 can't encode WebP and silently returns PNG; fall back to JPEG then.
  const webp = await encode("image/webp");
  const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg");
  if (!blob) throw new Error("Couldn't process this photo.");
  return blob;
}
