"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, PageHeader, PageWrap, PillChip, SectionCard, Sheet } from "@/components/dashboard/Kit";
import { M3Select } from "@/components/ui/M3Select";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { uploadFile } from "@/lib/storage/upload-client";
import { fmtDate } from "@/lib/format";
import { createMaterial, setMaterialStatus } from "./actions";

export interface MaterialRow { id: string; title: string; subject: string; type: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; fileId: string | null; createdAt: string }

export function TeacherLibrary({ rows, subjects, storageReady }: { rows: MaterialRow[]; subjects: { value: string; label: string }[]; storageReady: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [v, setV] = useState({ subjectId: "", title: "", description: "", publish: "true" });
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = () =>
    start(async () => {
      if (!file) return void toast.error("Choose a file to upload.");
      try {
        setPct(0);
        const fileId = await uploadFile("material", file, setPct);
        const r = await createMaterial({ ...v, fileId });
        if (!r.ok) return void toast.error(r.error);
        toast.success(v.publish === "true" ? "Material published" : "Saved as draft");
        setOpen(false); setFile(null); setV({ subjectId: "", title: "", description: "", publish: "true" });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setPct(null);
      }
    });

  const status = (id: string, s: "DRAFT" | "PUBLISHED" | "ARCHIVED") =>
    start(async () => {
      const r = await setMaterialStatus(id, s);
      if (r.ok) router.refresh(); else toast.error(r.error);
    });

  return (
    <PageWrap>
      <PageHeader eyebrow="Teaching" title="Library" description="Share notes, slides and videos with the divisions you teach. Students only see published material for their own subjects."
        actions={<button type="button" className="ds-btn sm" onClick={() => setOpen(true)} disabled={!storageReady || subjects.length === 0}><Icon name="upload" size={16} /> Upload material</button>} />
      {!storageReady && <div className="cd-banner" data-tone="warn" role="status"><Icon name="alert" size={16} /> File storage (Cloudflare R2) is not configured yet, so uploads are disabled.</div>}
      {storageReady && subjects.length === 0 && <div className="cd-banner" role="status"><Icon name="info" size={16} /> You are not assigned to any subject yet.</div>}
      <SectionCard title="My material" icon="read" count={rows.length}>
        {rows.length === 0 ? <p className="cd-muted">Nothing uploaded yet.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="My material">
              <thead><tr><th>Title</th><th>Subject</th><th>Type</th><th>Status</th><th>Added</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fileId ? <a href={`/api/files/${r.fileId}`} target="_blank" rel="noreferrer"><strong>{r.title}</strong></a> : <strong>{r.title}</strong>}</td>
                    <td>{r.subject}</td>
                    <td>{r.type.toLowerCase()}</td>
                    <td><PillChip tone={r.status === "PUBLISHED" ? "ok" : r.status === "DRAFT" ? "warn" : "neutral"}>{r.status.toLowerCase()}</PillChip></td>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td style={{ textAlign: "right" }}>
                      {r.status !== "PUBLISHED" && <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => status(r.id, "PUBLISHED")}>Publish</button>}{" "}
                      {r.status === "PUBLISHED" && <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => status(r.id, "DRAFT")}>Unpublish</button>}{" "}
                      {r.status !== "ARCHIVED" && <button type="button" className="dk-icon-btn" aria-label="Archive material" disabled={busy} onClick={() => status(r.id, "ARCHIVED")}><Icon name="archive" size={16} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Upload material" subtitle="PDF, Word, PowerPoint, Excel, images or MP4 up to 25 MB."
        footer={<><button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button type="button" className="ds-btn sm" disabled={busy || !file || !v.subjectId || !v.title.trim()} onClick={submit}>{pct !== null ? `Uploading ${pct}%` : "Upload"}</button></>}>
        <div className="cd-grid">
          <Field label="Subject" required><M3Select value={v.subjectId} onChange={(x) => setV((s) => ({ ...s, subjectId: x }))} options={subjects} placeholder="Choose subject" /></Field>
          <Field label="Title" required><input value={v.title} onChange={(e) => setV((s) => ({ ...s, title: e.target.value }))} maxLength={255} /></Field>
          <Field label="Description"><textarea value={v.description} onChange={(e) => setV((s) => ({ ...s, description: e.target.value }))} maxLength={2000} /></Field>
          <Field label="File" required>
            <input ref={input} type="file" accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Field label="Visibility">
            <M3Select value={v.publish} onChange={(x) => setV((s) => ({ ...s, publish: x }))} options={[{ value: "true", label: "Publish to students now" }, { value: "false", label: "Save as draft" }]} />
          </Field>
        </div>
      </Sheet>
    </PageWrap>
  );
}
