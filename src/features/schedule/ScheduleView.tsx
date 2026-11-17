"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PillChip, SectionCard } from "@/components/dashboard/Kit";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DaySchedule, ScheduleRow } from "./today";

const LABEL: Record<ScheduleRow["status"], string> = { completed: "Completed", current: "Now", upcoming: "Upcoming", break: "Break", cancelled: "Cancelled" };
const TONE = { completed: "neutral", current: "ok", upcoming: "accent", break: "warn", cancelled: "bad" } as const;

/** Today's timetable. Refreshes itself each minute so the "Now" marker stays right. */
export function ScheduleView({ schedule, audience }: { schedule: DaySchedule; audience: "student" | "teacher" }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <SectionCard title={`Today · ${schedule.dateLabel}`} icon="calendar" subtitle={`Times shown in ${schedule.timezone}`}>
      {!schedule.hasYear ? (
        <EmptyState title="No active academic year" hint="An administrator needs to activate an academic year." />
      ) : schedule.rows.length === 0 ? (
        <EmptyState title="Nothing scheduled today" hint={audience === "student" ? "You have no classes today, or you have not been enrolled in a class yet." : "You have no classes today."} />
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {schedule.rows.map((r) => (
            <li
              key={r.key}
              aria-current={r.status === "current" ? "true" : undefined}
              style={{
                display: "grid", gridTemplateColumns: "96px 1fr auto", gap: 12, alignItems: "center", padding: "10px 14px", borderRadius: 14,
                background: r.status === "current" ? "var(--md-primary-container)" : "var(--md-surface-container-low)",
                opacity: r.status === "completed" || r.status === "cancelled" ? 0.7 : 1,
              }}
            >
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{r.startTime}–{r.endTime}</span>
              <span style={{ display: "grid", lineHeight: 1.3, textDecoration: r.status === "cancelled" ? "line-through" : undefined }}>
                <strong>{r.kind === "CLASS" ? r.subject : r.kind === "LUNCH" ? "Lunch" : "Break"}</strong>
                <small className="cd-muted">
                  {r.kind === "CLASS" ? [audience === "student" ? r.teacher : r.division, r.classroom].filter(Boolean).join(" · ") : r.periodName}
                  {r.note ? ` — ${r.note}` : ""}
                </small>
              </span>
              <PillChip tone={TONE[r.status]}>{LABEL[r.status]}</PillChip>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
