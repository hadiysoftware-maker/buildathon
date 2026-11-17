"use client";
import "./attendance.css";

import { useMemo, useState, useTransition } from "react";
import { toast } from "@/components/ui/Toast";
import { saveAttendance } from "./actions";

type St = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "LEFT_EARLY";
const OPTIONS: { v: St; label: string; short: string }[] = [
  { v: "PRESENT", label: "Present", short: "P" },
  { v: "ABSENT", label: "Absent", short: "A" },
  { v: "LATE", label: "Late", short: "L" },
  { v: "EXCUSED", label: "Excused", short: "E" },
];
export interface MarkerStudent { id: string; name: string; code: string; status: St | null }

/** Roster with one-tap status buttons. Only students you mark are sent; saving again updates the earlier marks. */
export function AttendanceMarker({ entryId, date, students, readOnly, onSaved }: { entryId: string; date: string; students: MarkerStudent[]; readOnly?: boolean; onSaved?: (marked: number) => void }) {
  const [pending, start] = useTransition();
  const [marks, setMarks] = useState<Record<string, St | null>>(() => Object.fromEntries(students.map((s) => [s.id, s.status])));
  const [dirty, setDirty] = useState(false);

  const set = (id: string, v: St) => { setMarks((m) => ({ ...m, [id]: v })); setDirty(true); };
  const allPresent = () => { setMarks(Object.fromEntries(students.map((s) => [s.id, "PRESENT" as St]))); setDirty(true); };
  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, LEFT_EARLY: 0, none: 0 };
    for (const s of students) { const v = marks[s.id]; if (v) c[v]++; else c.none++; }
    return c;
  }, [marks, students]);

  const save = () => {
    const payload = students.flatMap((s) => (marks[s.id] ? [{ studentId: s.id, status: marks[s.id] as St }] : []));
    start(async () => {
      const r = await saveAttendance({ entryId, date, marks: payload });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Saved attendance for ${r.data?.saved ?? payload.length} students`);
      setDirty(false);
      onSaved?.(payload.length);
    });
  };

  if (students.length === 0) return <p className="cd-muted" role="status">No students are enrolled in this class yet.</p>;

  return (
    <div className="att">
      <div className="att-bar" role="status" aria-live="polite">
        <span><b>{counts.PRESENT}</b> present</span>
        <span><b>{counts.ABSENT}</b> absent</span>
        <span><b>{counts.LATE}</b> late</span>
        <span><b>{counts.EXCUSED}</b> excused</span>
        {counts.LEFT_EARLY > 0 && <span><b>{counts.LEFT_EARLY}</b> left early</span>}
        <span className="cd-muted">{counts.none} not marked</span>
      </div>
      {!readOnly && (
        <div className="cd-row" style={{ justifyContent: "space-between" }}>
          <button type="button" className="ds-btn tonal sm" onClick={allPresent} disabled={pending}>Mark all present</button>
          <button type="button" className="ds-btn sm" onClick={save} disabled={pending || !dirty}>{pending ? "Saving…" : dirty ? "Save attendance" : "Saved"}</button>
        </div>
      )}
      <ul className="att-list">
        {students.map((s) => (
          <li key={s.id} className="att-row" data-status={marks[s.id] ?? "none"}>
            <span className="att-who"><strong>{s.name}</strong><small className="cd-muted">{s.code}</small></span>
            <span className="att-btns" role="group" aria-label={`Attendance for ${s.name}`}>
              {OPTIONS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  className="att-btn"
                  data-v={o.v}
                  aria-pressed={marks[s.id] === o.v}
                  aria-label={`${o.label}: ${s.name}`}
                  title={o.label}
                  disabled={pending || readOnly}
                  onClick={() => set(s.id, o.v)}
                >
                  <span aria-hidden="true">{o.short}</span><span className="att-btn-l">{o.label}</span>
                </button>
              ))}
              {marks[s.id] === "LEFT_EARLY" && <span className="cd-chip" data-tone="warn">left early</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
