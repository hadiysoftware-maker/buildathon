"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, PageHeader, PageWrap, PillChip, SectionCard, Sheet } from "@/components/dashboard/Kit";
import { M3Select } from "@/components/ui/M3Select";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import { deleteQuiz, saveQuiz, setQuizState, type QuizQuestionInput } from "./actions";

export interface QuizRow {
  id: string; title: string; subjectId: string; divisionId: string; subject: string; division: string; timeLimitMin: number; randomize: boolean;
  showLeaderboard: boolean; scheduledFor: string | null; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; open: boolean; takers: number; avgPct: number | null;
  questions: QuizQuestionInput[];
}
export interface Pair { subjectId: string; divisionId: string; label: string }
export type DraftQuiz = { title: string; pair?: string; questions: QuizQuestionInput[] };

const blankQ = (): QuizQuestionInput => ({ type: "MULTIPLE_CHOICE", prompt: "", options: [{ label: "", isCorrect: true }, { label: "", isCorrect: false }, { label: "", isCorrect: false }, { label: "", isCorrect: false }], correctAnswer: "", explanation: "", points: 1 });
const toLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const TYPES = [{ value: "MULTIPLE_CHOICE", label: "Multiple choice" }, { value: "TRUE_FALSE", label: "True / False" }, { value: "SHORT_ANSWER", label: "Short answer" }];

export function TeacherQuizzes({ rows, pairs }: { rows: QuizRow[]; pairs: Pair[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [f, setF] = useState({ id: "", title: "", pair: "", timeLimitMin: "0", randomize: false, showLeaderboard: false, scheduledFor: "" });
  const [qs, setQs] = useState<QuizQuestionInput[]>([blankQ()]);

  const create = () => { setF({ id: "", title: "", pair: "", timeLimitMin: "0", randomize: false, showLeaderboard: false, scheduledFor: "" }); setQs([blankQ()]); setOpen(true); };
  const edit = (r: QuizRow) => {
    setF({ id: r.id, title: r.title, pair: `${r.subjectId}|${r.divisionId}`, timeLimitMin: String(r.timeLimitMin), randomize: r.randomize, showLeaderboard: r.showLeaderboard, scheduledFor: r.scheduledFor ? toLocal(r.scheduledFor) : "" });
    setQs(r.questions.length ? r.questions : [blankQ()]); setOpen(true);
  };
  const setQ = (i: number, p: Partial<QuizQuestionInput>) => setQs((a) => a.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const setOpt = (i: number, j: number, p: Partial<{ label: string; isCorrect: boolean }>) =>
    setQs((a) => a.map((q, k) => (k === i ? { ...q, options: (q.options ?? []).map((o, m) => (m === j ? { ...o, ...p } : p.isCorrect ? { ...o, isCorrect: false } : o)) } : q)));
  const setType = (i: number, type: string) =>
    setQ(i, { type: type as "MULTIPLE_CHOICE", options: type === "TRUE_FALSE" ? [{ label: "True", isCorrect: true }, { label: "False", isCorrect: false }] : type === "MULTIPLE_CHOICE" ? blankQ().options : [] });

  const submit = (publish: boolean) =>
    start(async () => {
      const [subjectId, divisionId] = f.pair.split("|");
      const r = await saveQuiz({
        id: f.id || undefined, title: f.title, subjectId: subjectId ?? "", divisionId: divisionId ?? "", timeLimitMin: Number(f.timeLimitMin) || 0, randomize: f.randomize,
        showLeaderboard: f.showLeaderboard, scheduledFor: f.scheduledFor ? new Date(f.scheduledFor).toISOString() : undefined, questions: qs, publish,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(publish ? "Quiz published" : "Quiz saved");
      setOpen(false); router.refresh();
    });
  const state = (id: string, s: "PUBLISH" | "CLOSE" | "UNPUBLISH" | "ARCHIVE") =>
    start(async () => { const r = await setQuizState(id, s); if (r.ok) router.refresh(); else toast.error(r.error); });
  const remove = (r: QuizRow) => {
    if (!confirm(`Delete "${r.title}"? Quizzes students have answered are archived instead.`)) return;
    start(async () => { const x = await deleteQuiz(r.id); if (x.ok) { toast.success("Deleted"); router.refresh(); } else toast.error(x.error); });
  };

  return (
    <PageWrap>
      <PageHeader eyebrow="Teaching" title="Quizzes" description="Build timed quizzes with auto-marking. Students see their score and explanations straight after."
        actions={<button type="button" className="ds-btn sm" onClick={create} disabled={pairs.length === 0}><Icon name="add" size={16} /> New quiz</button>} />
      {pairs.length === 0 && <div className="cd-banner" role="status"><Icon name="info" size={16} /> You are not assigned to any subject and class yet.</div>}
      <SectionCard title="My quizzes" icon="quiz" count={rows.length}>
        {rows.length === 0 ? <p className="cd-muted">No quizzes yet. Create one, or ask the Copilot to draft questions.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="My quizzes">
              <thead><tr><th>Quiz</th><th>Class</th><th>Questions</th><th>Taken</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/teacher/quizzes/${r.id}`}><strong>{r.title}</strong></Link><br /><small className="cd-muted">{r.subject}{r.timeLimitMin ? ` · ${r.timeLimitMin} min` : ""}{r.scheduledFor ? ` · opens ${fmtDateTime(r.scheduledFor)}` : ""}</small></td>
                    <td>{r.division}</td>
                    <td>{r.questions.length}</td>
                    <td>{r.takers}{r.avgPct !== null ? <small className="cd-muted"> · avg {r.avgPct}%</small> : null}</td>
                    <td><PillChip tone={r.status === "PUBLISHED" ? (r.open ? "ok" : "neutral") : r.status === "DRAFT" ? "warn" : "neutral"}>{r.status === "PUBLISHED" && !r.open ? "closed" : r.status.toLowerCase()}</PillChip></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {r.status === "DRAFT" && <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => state(r.id, "PUBLISH")}>Publish</button>}{" "}
                      {r.status === "PUBLISHED" && r.open && <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => state(r.id, "CLOSE")}>Close</button>}{" "}
                      {r.status === "PUBLISHED" && !r.open && <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => state(r.id, "PUBLISH")}>Reopen</button>}{" "}
                      {r.status !== "ARCHIVED" && r.takers === 0 && <button type="button" className="dk-icon-btn" aria-label={`Edit ${r.title}`} disabled={busy} onClick={() => edit(r)}><Icon name="edit" size={16} /></button>}{" "}
                      <button type="button" className="dk-icon-btn" aria-label={`Delete ${r.title}`} disabled={busy} onClick={() => remove(r)}><Icon name="delete" size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Sheet open={open} onClose={() => !busy && setOpen(false)} title={f.id ? "Edit quiz" : "New quiz"} subtitle="Questions are marked automatically."
        footer={<>
          <button type="button" className="ds-btn outline sm" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => submit(false)}>Save draft</button>
          <button type="button" className="ds-btn sm" disabled={busy} onClick={() => submit(true)}>{busy ? "Saving…" : "Save and publish"}</button>
        </>}>
        <div className="cd-grid">
          <Field label="Class and subject" required><M3Select value={f.pair} onChange={(x) => setF((s) => ({ ...s, pair: x }))} options={pairs.map((p) => ({ value: `${p.subjectId}|${p.divisionId}`, label: p.label }))} placeholder="Choose class and subject" /></Field>
          <Field label="Title" required><input value={f.title} maxLength={200} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></Field>
          <Field label="Time limit (minutes, 0 = none)"><input type="number" min={0} max={240} value={f.timeLimitMin} onChange={(e) => setF((s) => ({ ...s, timeLimitMin: e.target.value }))} /></Field>
          <Field label="Opens at (optional)"><input type="datetime-local" value={f.scheduledFor} onChange={(e) => setF((s) => ({ ...s, scheduledFor: e.target.value }))} /></Field>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.randomize} onChange={(e) => setF((s) => ({ ...s, randomize: e.target.checked }))} /> Shuffle question order</label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.showLeaderboard} onChange={(e) => setF((s) => ({ ...s, showLeaderboard: e.target.checked }))} /> Show a leaderboard to students</label>
          {qs.map((q, i) => (
            <fieldset key={i} className="ds-card" style={{ padding: 12, display: "grid", gap: 8, border: 0 }}>
              <legend><strong>Question {i + 1}</strong></legend>
              <M3Select value={q.type ?? "MULTIPLE_CHOICE"} onChange={(x) => setType(i, x)} options={TYPES} />
              <textarea rows={2} aria-label={`Question ${i + 1} text`} placeholder="Question" value={q.prompt} maxLength={2000} onChange={(e) => setQ(i, { prompt: e.target.value })} />
              {q.type === "SHORT_ANSWER" ? (
                <input aria-label="Correct answer" placeholder="Correct answer (matched ignoring case and spaces)" value={q.correctAnswer ?? ""} onChange={(e) => setQ(i, { correctAnswer: e.target.value })} />
              ) : (q.options ?? []).map((o, j) => (
                <div key={j} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="radio" name={`correct-${i}`} aria-label={`Option ${j + 1} is correct`} checked={o.isCorrect} onChange={() => setOpt(i, j, { isCorrect: true })} />
                  <input aria-label={`Option ${j + 1}`} placeholder={`Option ${j + 1}`} value={o.label} readOnly={q.type === "TRUE_FALSE"} onChange={(e) => setOpt(i, j, { label: e.target.value })} style={{ flex: 1 }} />
                </div>
              ))}
              <input aria-label="Explanation" placeholder="Explanation shown after answering (optional)" value={q.explanation ?? ""} onChange={(e) => setQ(i, { explanation: e.target.value })} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <label>Points <input type="number" min={0.5} step={0.5} style={{ width: 80 }} value={Number(q.points ?? 1)} onChange={(e) => setQ(i, { points: Number(e.target.value) })} /></label>
                {qs.length > 1 && <button type="button" className="ds-btn outline sm" onClick={() => setQs((a) => a.filter((_, k) => k !== i))}>Remove</button>}
              </div>
            </fieldset>
          ))}
          <button type="button" className="ds-btn tonal sm" disabled={qs.length >= 50} onClick={() => setQs((a) => [...a, blankQ()])}><Icon name="add" size={16} /> Add question</button>
        </div>
      </Sheet>
    </PageWrap>
  );
}
