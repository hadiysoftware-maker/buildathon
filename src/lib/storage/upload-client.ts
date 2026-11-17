"use client";

import { optimizeForUpload } from "@/lib/storage/optimize";

export type UploadArea = "avatar" | "material" | "chat" | "work";

/** Browser → R2 direct upload: presign, PUT with progress, then confirm. Returns the new file id. */
export async function uploadFile(area: UploadArea, original: File, onProgress?: (pct: number) => void): Promise<string> {
  const file = await optimizeForUpload(area, original);
  const mimeType = file.type || "application/octet-stream";
  const pre = await fetch("/api/files/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ area, mimeType, sizeBytes: file.size }),
  });
  const p = (await pre.json().catch(() => ({}))) as { key?: string; uploadUrl?: string; error?: string };
  if (!pre.ok || !p.key || !p.uploadUrl) throw new Error(p.error ?? "Could not start the upload.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", p.uploadUrl!);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload was rejected by storage.")));
    xhr.onerror = () => reject(new Error("Network error during upload. Check the bucket CORS settings."));
    xhr.send(file);
  });

  const done = await fetch("/api/files/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ area, key: p.key, fileName: file.name, mimeType }),
  });
  const d = (await done.json().catch(() => ({}))) as { fileId?: string; error?: string };
  if (!done.ok || !d.fileId) throw new Error(d.error ?? "Could not finish the upload.");
  return d.fileId;
}
