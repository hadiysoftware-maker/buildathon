"use client";
import "./attendance.css";

import { useState } from "react";
import { SectionCard } from "@/components/dashboard/Kit";
import { AttendanceMarker, type MarkerStudent } from "./AttendanceMarker";

export interface DaySlot { entryId: string; subject: string; division: string; periodName: string; startTime: string; endTime: string; substitute: boolean; total: number; marked: number }

/**
 * One day's classes. Every period's roster is loaded up front, so switching period is instant (no server round trip),
 * and each roster stays mounted, so marks you have not saved yet are kept while you look at another period.
 */
export function AttendanceDay({ slots, rosters, date, initialEntry }: { slots: DaySlot[]; rosters: Record<string, MarkerStudent[]>; date: string; initialEntry: string }) {
  const [active, setActive] = useState(initialEntry);
  const [done, setDone] = useState<Record<string, number>>({});
  const pick = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `/teacher/attendance?date=${date}&entry=${id}`);
  };
  return (
    <>
      <nav aria-label="Your classes" className="att-slots" role="tablist">
        {slots.map((x) => {
          const marked = done[x.entryId] ?? x.marked;
          return (
            <button key={x.entryId} type="button" role="tab" id={`tab-${x.entryId}`} aria-controls={`panel-${x.entryId}`} aria-selected={x.entryId === active} className="att-slot" aria-current={x.entryId === active ? "page" : undefined} onClick={() => pick(x.entryId)}>
              <strong>{x.subject}</strong>
              <span>{x.division} · {x.periodName}</span>
              <small className="cd-muted">{x.startTime}–{x.endTime}{x.substitute ? " · substitute" : ""}</small>
              <span className="cd-chip" data-tone={marked === 0 ? "warn" : marked >= x.total ? "ok" : "neutral"}>{marked === 0 ? "Not marked" : `${marked}/${x.total} marked`}</span>
            </button>
          );
        })}
      </nav>
      {slots.map((x) => (
        <div key={x.entryId} id={`panel-${x.entryId}`} role="tabpanel" aria-labelledby={`tab-${x.entryId}`} hidden={x.entryId !== active}>
          <SectionCard title={`${x.subject} · ${x.division}`} subtitle={`${x.periodName} · ${x.startTime}–${x.endTime} · ${date}`}>
            <AttendanceMarker entryId={x.entryId} date={date} students={rosters[x.entryId] ?? []} onSaved={(n) => setDone((d) => ({ ...d, [x.entryId]: n }))} />
          </SectionCard>
        </div>
      ))}
    </>
  );
}
