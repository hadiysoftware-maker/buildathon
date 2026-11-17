"use client";

import type { UploadArea } from "@/lib/storage/upload-client";

/** Longest edge allowed per area, in pixels. Avatars are tiny; chat images only need to be readable by the vision model. */
const MAX_EDGE: Record<UploadArea, number> = { avatar: 512, chat: 1568, material: 2048, work: 1600 };
const QUALITY = 0.82;
const CONVERTIBLE = new Set(["image/jpeg", "image/png", "image/bmp"]);

/**
 * Shrinks images before upload: resized to a sensible maximum and re-encoded as WebP (usually 25-80% smaller).
 * Everything else (PDF, video, Office files, GIF animation, text) is sent unchanged. Any failure, or a result that
 * is not smaller, falls back to the original file, so optimisation can never block an upload.
 */
export async function optimizeForUpload(area: UploadArea, file: File): Promise<File> {
  const type = file.type;
  const isWebp = type === "image/webp";
  if (!CONVERTIBLE.has(type) && !isWebp) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const max = MAX_EDGE[area];
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    // An already-small WebP needs no work.
    if (isWebp && scale === 1) { bmp.close(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bmp.close(); return file; }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", QUALITY));
    if (!blob || blob.type !== "image/webp") return file;
    if (scale === 1 && blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}.webp`, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}
