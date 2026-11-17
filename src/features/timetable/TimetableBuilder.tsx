"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, PageHeader, PageWrap, SectionCard, Sheet } from "@/components/dashboard/Kit";
import { M3Select } from "@/components/ui/M3Select";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { DAY_NAMES } from "@/lib/format";
import type { Conflict } from "@/lib/timetable/conflicts";
import { copyTimetable, removeTimetableEntry, setTimetableEntry } from "./actions";

type Opt = { value: string; label: string };
export interface BuilderEntry {
  id: string;
  divisionId: string;
  dayOfWeek: number;
  periodId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string | null;
  divisionLabel: string;
  status: "ACTIVE" | "CANCELLED";
}
export interface BuilderPeriod { id: string; name: string; startTime: string; endTime: string; kind: "CLASS" | "BREAK" | "LUNCH" }

type View = "class" | "teacher" | "classroom";

/**
 * Weekly grid. "Class" view is editable (click a cell); teacher/classroom views are read-only
 * lenses over the same data so double bookings are easy to spot.
 */
export function TimetableBuilder(p: {
  entries: BuilderEntry[];
  periods: BuilderPeriod[];
  divisions: Opt[];
  teachers: Opt[];
  classrooms: Opt[];
  subjects: Opt[];
  workingDays: number[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<View>("class");
  const [target, setTarget] = useState(p.divisions[0]?.value ?? "");
  const [cell, setCell] = useState<{ day: number; period: BuilderPeriod } | null>(null);
  const [form, setForm] = useState({ subjectId: "", teacherId: "", classroomId: "" });
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [copyTo, setCopyTo] = useState("");

  const options = view === "class" ? p.divisions : view === "teacher" ? p.teachers : p.classrooms;
  const current = options.some((o) => o.value === target) ? target : (options[0]?.value ?? "");

  const visible = useMemo(
    () =>
      p.entries.filter((e) =>
        view === "class" ? e.divisionId === current : view === "teacher" ? e.teacherId === current : e.classroomId === current,
      ),
    [p.entries, view, current],
  );
  const at = (day: number, periodId: string) => visible.find((e) => e.dayOfWeek === day && e.periodId === periodId && e.status === "ACTIVE");

  const open = (day: number, period: BuilderPeriod) => {
    if (view !== "class" || period.kind !== "CLASS") return;
    const e = at(day, period.id);
    setForm({ subjectId: e?.subjectId ?? "", teacherId: e?.teacherId ?? "", classroomId: e?.classroomId ?? "" });
    setConflicts([]);
    setCell({ day, period });
  };

  const save = () =>
    start(async () => {
      if (!cell) return;
      const r = await setTimetableEntry({ divisionId: current, dayOfWeek: String(cell.day), periodId: cell.period.id, ...form });
      if (!r.ok) return void toast.error(r.error);
      if ("conflicts" in r.data) return setConflicts(r.data.conflicts);
      toast.success("Timetable updated");
      setCell(null);
      router.refresh();
    });

  const clear = () =>
    start(async () => {
      const e = cell && at(cell.day, cell.period.id);
      if (!e) return;
      const r = await removeTimetableEntry(e.id);
      if (r.ok) { toast.success("Entry removed"); setCell(null); router.refresh(); } else toast.error(r.error);
    });

  const copy = () =>
    start(async () => {
      const r = await copyTimetable(current, copyTo);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Copied ${r.data.copied} entries${r.data.skipped ? `, skipped ${r.data.skipped} that would clash` : ""}`);
      router.refresh();
    });

  return (
    <PageWrap>
      <PageHeader eyebrow="Academic management" title="Timetable" description="Build the weekly schedule. Teacher, classroom and class clashes are blocked before saving." />

      <SectionCard
        title="Schedule"
        icon="calendar"
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="dk-seg" role="tablist">
              {(["class", "teacher", "classroom"] as View[]).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ minWidth: 220 }}>
              <M3Select value={current} onChange={setTarget} options={options} placeholder={`Choose ${view}`} aria-label={`Select ${view}`} />
            </div>
          </div>
        }
      >
        {p.periods.length === 0 ? (
          <p className="cd-muted">Add periods first (Academic management → Periods).</p>
        ) : options.length === 0 ? (
          <p className="cd-muted">Nothing to show yet. Create classes, teachers and classrooms first.</p>
        ) : (
          <div className="dk-table-wrap">
            <table className="dk-table tt-grid" aria-label="Weekly timetable" data-no-rt="1" style={{ minWidth: 130 + p.workingDays.length * 150 }}>
              <thead>
                <tr>
                  <th>Period</th>
                  {p.workingDays.map((d) => <th key={d}>{DAY_NAMES[d]}</th>)}
                </tr>
              </thead>
              <tbody>
                {p.periods.map((per) => (
                  <tr key={per.id}>
                    <td><strong>{per.name}</strong><br /><small className="cd-muted">{per.startTime}–{per.endTime}</small></td>
                    {per.kind !== "CLASS" ? (
                      <td colSpan={p.workingDays.length} style={{ textAlign: "left" }} className="cd-muted">{per.kind === "LUNCH" ? "Lunch" : "Break"}</td>
                    ) : (
                      p.workingDays.map((d) => {
                        const e = at(d, per.id);
                        return (
                          <td key={d}>
                            <button
                              type="button"
                              onClick={() => open(d, per)}
                              disabled={view !== "class"}
                              aria-label={`${DAY_NAMES[d]} ${per.name}`}
                              className={e ? "ds-btn tonal sm" : "ds-btn outline sm"}
                              style={{ width: "100%", justifyContent: "flex-start", height: "auto", minHeight: 44, padding: "6px 10px", textAlign: "left", whiteSpace: "normal" }}
                            >
                              {e ? (
                                <span style={{ display: "grid", lineHeight: 1.25 }}>
                                  <strong>{e.subjectName}</strong>
                                  <small>{view === "teacher" ? e.divisionLabel : e.teacherName}{e.classroomName ? ` · ${e.classroomName}` : ""}</small>
                                </span>
                              ) : view === "class" ? <span className="cd-muted">+ Add</span> : <span className="cd-muted">—</span>}
                            </button>
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {view === "class" && current && p.divisions.length > 1 && (
        <SectionCard title="Copy this timetable" icon="copy" subtitle="Copies subjects and teachers to another class, skipping any slot that would clash.">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ minWidth: 240 }}>
              <M3Select value={copyTo} onChange={setCopyTo} options={p.divisions.filter((d) => d.value !== current)} placeholder="Copy to…" aria-label="Copy to class" />
            </div>
            <button type="button" className="ds-btn sm" disabled={!copyTo || pending} onClick={copy}>Copy</button>
          </div>
        </SectionCard>
      )}

      <Sheet
        open={!!cell}
        onClose={() => setCell(null)}
        title={cell ? `${DAY_NAMES[cell.day]} · ${cell.period.name}` : ""}
        subtitle={cell ? `${cell.period.startTime}–${cell.period.endTime}` : undefined}
        footer={
          <>
            {cell && at(cell.day, cell.period.id) && (
              <button type="button" className="ds-btn outline sm danger" disabled={pending} onClick={clear}>Remove</button>
            )}
            <button type="button" className="ds-btn sm" disabled={pending || !form.subjectId || !form.teacherId} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="cd-grid">
          <Field label="Subject" required><M3Select value={form.subjectId} onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))} options={p.subjects} placeholder="Choose subject" /></Field>
          <Field label="Teacher" required><M3Select value={form.teacherId} onChange={(v) => setForm((f) => ({ ...f, teacherId: v }))} options={p.teachers} placeholder="Choose teacher" /></Field>
          <Field label="Classroom"><M3Select value={form.classroomId} onChange={(v) => setForm((f) => ({ ...f, classroomId: v }))} options={[{ value: "", label: "— None —" }, ...p.classrooms]} /></Field>
          {conflicts.length > 0 && (
            <div className="cd-banner" data-tone="bad" role="alert">
              <Icon name="alert" size={16} />
              <ul style={{ margin: 0, paddingLeft: 18 }}>{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
            </div>
          )}
        </div>
      </Sheet>
    </PageWrap>
  );
}
