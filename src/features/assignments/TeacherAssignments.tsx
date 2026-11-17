"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, PageHeader, PageWrap, PillChip, SectionCard, Sheet } from "@/components/dashboard/Kit";
import { M3Select } from "@/components/ui/M3Select";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { uploadFile } from "@/lib/storage/upload-client";
import { fmtDateTime } from "@/lib/format";
import { deleteAssignment, saveAssignment, setAssignmentStatus } from "./actions";

export interface AssignmentRow {
  id: string; title: string; instructions: string; subjectId: string; divisionId: string; subject: string; division: string;
  submissionType: string; maxMarks: number; dueAt: string; allowLate: boolean; allowResubmission: boolean;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED"; submitted: number; graded: number; total: number;
}
export interface Pair { subjectId: string; divisionId: string; label: string }

const TYPES = [
  { value: "WRITTEN", label: "Written answer" }, { value: "PDF", label: "PDF upload" }, { value: "DOCUMENT", label: "Document upload" },
  { value: "IMAGE", label: "Photo of work" }, { value: "SHORT_ANSWER", label: "Short answer" }, { value: "PRACTICAL", label: "Practical" },
];
const tone = (s: string) => (s === "PUBLISHED" ? "ok" : s === "DRAFT" ? "warn" : "neutral");
const toLocalInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const blank = () => ({ id: "", title: "", instructions: "", pair: "", submissionType: "WRITTEN", maxMarks: "10", dueAt: "", allowLate: false, allowResubmission: false });

export function TeacherAssignments({ rows, pairs, storageReady }: { rows: AssignmentRow[]; pairs: Pair[]; storageReady: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [f, setF] = useState(blank());
  const [files, setFiles] = useState<File[]>([]);
  const [filter, setFilter] = useState("ALL");

  const edit = (r: AssignmentRow) => {
    setF({ id: r.id, title: r.title, instructions: r.instructions, pair: `${r.subjectId}|${r.divisionId}`, submissionType: r.submissionType, maxMarks: String(r.maxMarks), dueAt: toLocalInput(r.dueAt), allowLate: r.allowLate, allowResubmission: r.allowResubmission });
    setFiles([]); setOpen(true);
  };
  const create = () => { setF(blank()); setFiles([]); setOpen(true); };

  const submit = (publish: boolean) =>
    start(async () => {
      try {
        const [subjectId, divisionId] = f.pair.split("|");
        const fileIds: string[] = [];
        for (const file of files) fileIds.push(await uploadFile("work", file));
        const r = await saveAssignment({
          id: f.id || undefined, title: f.title, instructions: f.instructions, subjectId: subjectId ?? "", divisionId: divisionId ?? "",
          submissionType: f.submissionType as "WRITTEN", maxMarks: Number(f.maxMarks), dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : "",
          allowLate: f.allowLate, allowResubmission: f.allowResubmission, fileIds, publish,
        });
        if (!r.ok) return void toast.error(r.error);
        toast.success(publish ? "Assignment published" : "Saved");
        setOpen(false); router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
    });

  const status = (id: string, s: AssignmentRow["status"]) =>
    start(async () => { const r = await setAssignmentStatus(id, s); if (r.ok) router.refresh(); else toast.error(r.error); });
  const remove = (r: AssignmentRow) => {
    if (!confirm(`Delete "${r.title}"? Assignments with submissions are archived instead.`)) return;
    start(async () => { const x = await deleteAssignment(r.id); if (x.ok) { toast.success("Deleted"); router.refresh(); } else toast.error(x.error); });
  };

  const shown = rows.filter((r) => (filter === "ALL" ? r.status !== "ARCHIVED" : r.status === filter));
  return (
    <PageWrap>
      <PageHeader eyebrow="Teaching" title="Assignments" description="Set work for the classes you teach, collect submissions, grade and release marks."
        actions={<button type="button" className="ds-btn sm" onClick={create} disabled={pairs.length === 0}><Icon name="add" size={16} /> New assignment</button>} />
      {pairs.length === 0 && <div className="cd-banner" role="status"><Icon name="info" size={16} /> You are not assigned to any subject and class yet.</div>}
      <SectionCard title="My assignments" icon="checkSquare" count={shown.length}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {["ALL", "DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"].map((s) => (
            <button key={s} type="button" className={`ds-btn sm ${filter === s ? "tonal" : "outline"}`} onClick={() => setFilter(s)}>{s === "ALL" ? "Active" : s.charAt(0) + s.slice(1).toLowerCase()}</button>
          ))}
        </div>
        {shown.length === 0 ? <p className="cd-muted">Nothing here yet.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="My assignments">
              <thead><tr><th>Title</th><th>Class</th><th>Due</th><th>Submitted</th><th>Status</th><th /></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/teacher/assignments/${r.id}`}><strong>{r.title}</strong></Link><br /><small className="cd-muted">{r.subject} · {r.maxMarks} marks</small></td>
                    <td>{r.division}</td>
                    <td>{fmtDateTime(r.dueAt)}</td>
                    <td>{r.submitted}/{r.total}{r.submitted > r.graded ? <small className="cd-muted"> · {r.submitted - r.graded} to grade</small> : null}</td>
                    <td><PillChip tone={tone(r.status)}>{r.status.toLowerCase()}</PillChip></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {r.status === "DRAFT" && <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => status(r.id, "PUBLISHED")}>Publish</button>}{" "}
                      {r.status === "PUBLISHED" && <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => status(r.id, "CLOSED")}>Close</button>}{" "}
                      {r.status === "CLOSED" && <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => status(r.id, "PUBLISHED")}>Reopen</button>}{" "}
                      {r.status !== "ARCHIVED" && <button type="button" className="dk-icon-btn" aria-label={`Edit ${r.title}`} disabled={busy} onClick={() => edit(r)}><Icon name="edit" size={16} /></button>}{" "}
                      <button type="button" className="dk-icon-btn" aria-label={`Delete ${r.title}`} disabled={busy} onClick={() => remove(r)}><Icon name="delete" size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title={f.id ? "Edit assignment" : "New assignment"} subtitle="Students in the chosen class are notified when you publish."
        footer={<>
          <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => submit(false)}>Save draft</button>
          <button type="button" className="ds-btn sm" disabled={busy} onClick={() => submit(true)}>{busy ? "Saving…" : "Save and publish"}</button>
        </>}>
        <div className="cd-grid">
          <Field label="Class and subject" required><M3Select value={f.pair} onChange={(x) => setF((s) => ({ ...s, pair: x }))} options={pairs.map((p) => ({ value: `${p.subjectId}|${p.divisionId}`, label: p.label }))} placeholder="Choose class and subject" /></Field>
          <Field label="Title" required><input value={f.title} maxLength={200} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></Field>
          <Field label="Instructions" required><textarea rows={5} value={f.instructions} maxLength={8000} onChange={(e) => setF((s) => ({ ...s, instructions: e.target.value }))} /></Field>
          <Field label="Students submit"><M3Select value={f.submissionType} onChange={(x) => setF((s) => ({ ...s, submissionType: x }))} options={TYPES} /></Field>
          <Field label="Maximum marks" required><input type="number" min={1} max={1000} value={f.maxMarks} onChange={(e) => setF((s) => ({ ...s, maxMarks: e.target.value }))} /></Field>
          <Field label="Due" required><input type="datetime-local" value={f.dueAt} onChange={(e) => setF((s) => ({ ...s, dueAt: e.target.value }))} /></Field>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.allowLate} onChange={(e) => setF((s) => ({ ...s, allowLate: e.target.checked }))} /> Accept late submissions (marked late)</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.allowResubmission} onChange={(e) => setF((s) => ({ ...s, allowResubmission: e.target.checked }))} /> Allow resubmission</label>
          <Field label="Attachments (optional, up to 5)">
            <input type="file" multiple disabled={!storageReady} accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.txt" aria-label="Attach files" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))} />
          </Field>
        </div>
      </Sheet>
    </PageWrap>
  );
}
