"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PillChip, SectionCard } from "@/components/dashboard/Kit";
import { toast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import { draftFeedback } from "./ai";
import { gradeSubmission, releaseAllGrades, requestResubmission } from "./actions";

export interface SubmissionRow {
  id: string; student: string; code: string; status: string; isLate: boolean; attempt: number; submittedAt: string; text: string | null;
  files: { id: string; name: string }[]; marks: number | null; gradeStatus: "DRAFT" | "RELEASED" | null; feedback: string[];
}

export function GradingPanel({ assignmentId, maxMarks, rows, missing }: { assignmentId: string; maxMarks: number; rows: SubmissionRow[]; missing: { name: string; code: string }[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, { marks: string; feedback: string }>>({});
  const val = (r: SubmissionRow) => draft[r.id] ?? { marks: r.marks === null ? "" : String(r.marks), feedback: "" };
  const set = (id: string, r: SubmissionRow, p: Partial<{ marks: string; feedback: string }>) => setDraft((d) => ({ ...d, [id]: { ...val(r), ...p } }));

  const grade = (r: SubmissionRow, release: boolean) =>
    start(async () => {
      const v = val(r);
      if (v.marks === "") return void toast.error("Enter marks first.");
      const x = await gradeSubmission({ submissionId: r.id, marks: Number(v.marks), feedback: v.feedback, release });
      if (!x.ok) return void toast.error(x.error);
      toast.success(release ? "Grade released" : "Draft saved");
      setDraft((d) => { const n = { ...d }; delete n[r.id]; return n; });
      router.refresh();
    });
  const redo = (r: SubmissionRow) => {
    const note = prompt("Tell the student what to improve (optional):") ?? null;
    if (note === null) return;
    start(async () => { const x = await requestResubmission(r.id, note); if (x.ok) { toast.success("Resubmission requested"); router.refresh(); } else toast.error(x.error); });
  };
  const releaseAll = () => start(async () => { const x = await releaseAllGrades(assignmentId); if (x.ok) { toast.success(`Released ${x.data?.released ?? 0} grades`); router.refresh(); } else toast.error(x.error); });
  const drafts = rows.filter((r) => r.gradeStatus === "DRAFT").length;

  const draftAi = (r: SubmissionRow) => start(async () => {
    const x = await draftFeedback(r.id);
    if (!x.ok || !x.data) return void toast.error(x.ok ? "No draft." : x.error);
    set(r.id, r, { feedback: x.data.feedback, ...(val(r).marks === "" && x.data.marks !== null ? { marks: String(x.data.marks) } : {}) });
    toast.success("Draft ready. Check it, edit it, then save or release.");
  });
  return (
    <>
      <SectionCard title="Submissions" icon="checkSquare" count={rows.length}>
        {drafts > 0 && <p><button type="button" className="ds-btn tonal sm" disabled={busy} onClick={releaseAll}>Release {drafts} draft grade{drafts === 1 ? "" : "s"}</button></p>}
        {rows.length === 0 ? <p className="cd-muted">No submissions yet.</p> : (
          <div style={{ display: "grid", gap: 14 }}>
            {rows.map((r) => {
              const v = val(r);
              return (
                <article key={r.id} className="ds-card" style={{ padding: 14, display: "grid", gap: 8 }}>
                  <header style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span><strong>{r.student}</strong> <small className="cd-muted">{r.code} · attempt {r.attempt} · {fmtDateTime(r.submittedAt)}</small></span>
                    <span style={{ display: "flex", gap: 6 }}>
                      {r.isLate && <PillChip tone="warn">late</PillChip>}
                      <PillChip tone={r.gradeStatus === "RELEASED" ? "ok" : r.gradeStatus === "DRAFT" ? "warn" : "neutral"}>{r.gradeStatus === "RELEASED" ? "released" : r.gradeStatus === "DRAFT" ? "draft grade" : r.status.toLowerCase().replace("_", " ")}</PillChip>
                    </span>
                  </header>
                  {r.text && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.text}</p>}
                  {r.files.length > 0 && <p style={{ margin: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>{r.files.map((f) => <a key={f.id} className="ds-btn outline sm" href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a>)}</p>}
                  {r.feedback.length > 0 && <small className="cd-muted">Earlier feedback: {r.feedback.join(" · ")}</small>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                    <label style={{ display: "grid", gap: 4 }}><small>Marks / {maxMarks}</small><input type="number" min={0} max={maxMarks} step="0.5" style={{ width: 100 }} value={v.marks} onChange={(e) => set(r.id, r, { marks: e.target.value })} /></label>
                    <label style={{ display: "grid", gap: 4, flex: 1, minWidth: 200 }}><small>Feedback to student</small><input value={v.feedback} maxLength={4000} onChange={(e) => set(r.id, r, { feedback: e.target.value })} placeholder="What went well, what to improve" /></label>
                    {r.text && <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => draftAi(r)}>Draft with Nova</button>}
                    <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => grade(r, false)}>Save draft</button>
                    <button type="button" className="ds-btn sm" disabled={busy} onClick={() => grade(r, true)}>Release</button>
                    <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => redo(r)}>Ask to redo</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
      {missing.length > 0 && (
        <SectionCard title="Not submitted yet" icon="clock" count={missing.length}>
          <p style={{ margin: 0 }}>{missing.map((m) => `${m.name} (${m.code})`).join(", ")}</p>
        </SectionCard>
      )}
    </>
  );
}
