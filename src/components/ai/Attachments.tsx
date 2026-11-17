"use client";
import "./attachments.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { uploadFile } from "@/lib/storage/upload-client";
import type { AttachedFile } from "@/lib/ai/blocks";

export const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,.md,.csv,.txt";
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown", "text/csv"]);
const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // the vision model accepts about 4 MB once encoded

export interface PendingFile { key: string; name: string; mime: string; pct: number; status: "uploading" | "ready" | "error"; id?: string; preview?: string }

/** Upload state for files attached to the next message. Files go straight to R2 (area "chat"); only their ids are sent to the chat API. */
export function useAttachments() {
  const [items, setItems] = useState<PendingFile[]>([]);
  const previews = useRef<string[]>([]);

  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const add = useCallback(async (list: FileList | File[]) => {
    const files = [...list];
    const room = MAX_FILES - items.length;
    if (files.length > room) toast.error(`You can attach up to ${MAX_FILES} files per message.`);
    for (const f of files.slice(0, Math.max(0, room))) {
      const mime = f.type || (/\.md$/i.test(f.name) ? "text/markdown" : /\.csv$/i.test(f.name) ? "text/csv" : /\.txt$/i.test(f.name) ? "text/plain" : "");
      if (!ALLOWED.has(mime)) { toast.error(`${f.name}: use an image, PDF or text file.`); continue; }
      if (f.size > (mime.startsWith("image/") && mime !== "image/gif" ? MAX_BYTES * 2 : MAX_BYTES)) { toast.error(`${f.name} is too large.`); continue; }
      if (mime === "image/gif" && f.size > MAX_IMAGE_BYTES) { toast.error(`${f.name}: GIFs must be under 3 MB.`); continue; }
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const preview = mime.startsWith("image/") ? URL.createObjectURL(f) : undefined;
      if (preview) previews.current.push(preview);
      setItems((p) => [...p, { key, name: f.name, mime, pct: 0, status: "uploading", preview }]);
      try {
        const named = f.type === mime ? f : new File([f], f.name, { type: mime });
        const id = await uploadFile("chat", named, (pct) => setItems((p) => p.map((x) => (x.key === key ? { ...x, pct } : x))));
        setItems((p) => p.map((x) => (x.key === key ? { ...x, status: "ready", pct: 100, id } : x)));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed.");
        setItems((p) => p.filter((x) => x.key !== key));
      }
    }
  }, [items.length]);

  const remove = useCallback((key: string) => setItems((p) => p.filter((x) => x.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);
  return {
    items,
    add,
    remove,
    clear,
    uploading: items.some((i) => i.status === "uploading"),
    ids: items.flatMap((i) => (i.id ? [i.id] : [])),
    files: items.flatMap((i): AttachedFile[] => (i.id ? [{ id: i.id, name: i.name, mime: i.mime }] : [])),
  };
}

/** The "+" button: opens the file picker. */
export function AttachButton({ onPick, disabled }: { onPick: (f: FileList) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="ds-icon-btn att-plus" disabled={disabled} onClick={() => ref.current?.click()} aria-label="Attach an image, PDF or text file" title="Attach a file">
        <Icon name="add" size={18} />
      </button>
      <input
        ref={ref}
        type="file"
        hidden
        multiple
        accept={ACCEPT}
        onChange={(e) => { if (e.target.files?.length) onPick(e.target.files); e.target.value = ""; }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}

/** Files waiting to be sent, with progress and a remove button. */
export function PendingChips({ items, onRemove }: { items: PendingFile[]; onRemove: (key: string) => void }) {
  if (!items.length) return null;
  return (
    <ul className="att-chips" aria-label="Attached files">
      {items.map((i) => (
        <li key={i.key} className="att-chip" data-status={i.status}>
          {i.preview ? <img src={i.preview} alt="" width={28} height={28} /> : <span className="att-ficon" aria-hidden="true">{i.mime === "application/pdf" ? "PDF" : "TXT"}</span>}
          <span className="att-name" title={i.name}>{i.name}</span>
          {i.status === "uploading" && <small aria-live="polite">{i.pct}%</small>}
          <button type="button" onClick={() => onRemove(i.key)} aria-label={`Remove ${i.name}`}><Icon name="close" size={14} /></button>
        </li>
      ))}
    </ul>
  );
}

/** Files shown inside a sent message. Images load through the access-checked /api/files route (only the uploader can open them). */
export function MessageFiles({ files }: { files?: AttachedFile[] }) {
  if (!files?.length) return null;
  return (
    <ul className="att-sent" aria-label="Attached files">
      {files.map((f) => (
        <li key={f.id}>
          {f.mime.startsWith("image/") ? (
            <a href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${f.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${f.id}`} alt={f.name} loading="lazy" />
            </a>
          ) : (
            <a className="att-file" href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer"><span className="att-ficon" aria-hidden="true">{f.mime === "application/pdf" ? "PDF" : "TXT"}</span>{f.name}</a>
          )}
        </li>
      ))}
    </ul>
  );
}

export const FILE_PROMPTS = ["Summarise this", "Make 5 quiz questions from this", "Create a presentation outline", "Explain it simply"];
