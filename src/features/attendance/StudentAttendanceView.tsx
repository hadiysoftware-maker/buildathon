"use client";
import "./attendance.css";

import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/Kit";

type St = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "LEFT_EARLY";
export interface AttRow { id: string; date: string; period: string; subject: string; status: St }
const LABEL: Record<St, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", EXCUSED: "Excused", LEFT_EARLY: "Left early" };
const TONE: Record<St, string> = { PRESENT: "ok", LATE: "warn", LEFT_EARLY: "warn", EXCUSED: "neutral", ABSENT: "bad" };
const RANGES = [{ days: 7, label: "7 days" }, { days: 30, label: "30 days" }, { days: 90, label: "90 days" }] as const;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** The student's record with a range switch. All 90 days arrive once, so changing the range is instant. */
export function StudentAttendanceView({ rows, today }: { rows: AttRow[]; today: string }) {
  const [days, setDays] = useState<number>(30);
  const view = useMemo(() => {
    const from = new Date(`${today}T00:00:00Z`).getTime() - (days - 1) * 86_400_000;
    const list = rows.filter((r) => new Date(`${r.date}T00:00:00Z`).getTime() >= from);
    const counts: Record<St, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, LEFT_EARLY: 0 };
    const subj = new Map<string, { present: number; total: number }>();
    for (const r of list) {
      counts[r.status]++;
      if (r.status === "EXCUSED") continue;
      const s = subj.get(r.subject) ?? { present: 0, total: 0 };
      s.total++;
      if (r.status !== "ABSENT") s.present++;
      subj.set(r.subject, s);
    }
    const counted = list.length - counts.EXCUSED;
    const rate = counted > 0 ? Math.round(((counted - counts.ABSENT) / counted) * 100) : null;
    const bySubject = [...subj.entries()].map(([subject, v]) => ({ subject, ...v, pct: Math.round((v.present / v.total) * 100) })).sort((a, b) => a.pct - b.pct);
    return { list, counts, rate, bySubject };
  }, [rows, today, days]);

  return (
    <>
      <div className="att-range" role="tablist" aria-label="Time range">
        {RANGES.map((r) => <button key={r.days} type="button" role="tab" aria-selected={days === r.days} onClick={() => setDays(r.days)}>{r.label}</button>)}
      </div>

      {view.list.length === 0 ? (
        <p className="cd-muted" role="status">No classes were marked in the last {days} days.</p>
      ) : (
        <>
          <div className="ai-stats" role="group" aria-label="Attendance summary">
            <div className="ai-stat" data-tone="0"><b>{view.rate === null ? "–" : `${view.rate}%`}</b><span>Attendance rate</span></div>
            <div className="ai-stat" data-tone="1"><b>{view.counts.PRESENT}</b><span>Present</span></div>
            <div className="ai-stat" data-tone="2"><b>{view.counts.ABSENT}</b><span>Absent</span></div>
            <div className="ai-stat" data-tone="3"><b>{view.counts.LATE + view.counts.LEFT_EARLY}</b><span>Late or left early</span></div>
          </div>

          <SectionCard title="By subject" subtitle="Share of classes attended">
            <div className="ai-bars">
              {view.bySubject.map((x) => (
                <div key={x.subject} className="ai-bar-row" role="img" aria-label={`${x.subject}: ${x.pct} percent, ${x.present} of ${x.total} classes`}>
                  <span className="ai-bar-label">{x.subject}</span>
                  <span className="ai-bar-track"><span className="ai-bar-fill" style={{ width: `${x.pct}%` }} /></span>
                  <b>{x.pct}%</b>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recent classes" subtitle={`Latest ${Math.min(40, view.list.length)} in this range`} noPadding>
            <div className="dk-table-wrap" style={{ border: 0 }}>
              <table className="dk-table">
                <thead><tr><th>Date</th><th>Period</th><th>Subject</th><th>Status</th></tr></thead>
                <tbody>
                  {view.list.slice(0, 40).map((r) => (
                    <tr key={r.id}>
                      <td>{day(r.date)}</td>
                      <td>{r.period}</td>
                      <td>{r.subject}</td>
                      <td><span className="cd-chip" data-tone={TONE[r.status]}>{LABEL[r.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}
