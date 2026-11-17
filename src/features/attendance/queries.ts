import "server-only";
import { prisma } from "@/lib/db";

export const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "LEFT_EARLY"] as const;
export type AttStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<AttStatus, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", EXCUSED: "Excused", LEFT_EARLY: "Left early" };

import { dowOf, ymdToDate } from "./dates";
export { dowOf, isYmd, MAX_BACKDATE_DAYS, shiftYmd, todayYmd, ymdToDate } from "./dates";

export interface Slot {
  entryId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  subject: string;
  division: string;
  divisionId: string;
  total: number;
  marked: number;
  substitute: boolean;
}

/** The classes a teacher runs on a date: their own entries plus substitutions to them, minus cancellations. */
export async function teacherSlots(institutionId: string, userId: string, ymd: string): Promise<{ teacherId: string; timezone: string; slots: Slot[] } | null> {
  const [inst, t] = await Promise.all([
    prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { timezone: true } }),
    prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  if (!t) return null;
  const date = ymdToDate(ymd);
  const year = await prisma.academicYear.findFirst({ where: { institutionId, status: "ACTIVE" }, select: { id: true } });
  if (!year) return { teacherId: t.id, timezone: inst.timezone, slots: [] };

  const entries = await prisma.timetableEntry.findMany({
    where: {
      academicYearId: year.id, dayOfWeek: dowOf(ymd), status: "ACTIVE", period: { kind: "CLASS" },
      OR: [{ teacherId: t.id }, { overrides: { some: { date, type: "SUBSTITUTED", substituteTeacherId: t.id } } }],
    },
    include: {
      period: { select: { name: true, startTime: true, endTime: true, sequence: true } },
      subject: { select: { name: true } },
      division: { select: { name: true, class: { select: { name: true } } } },
      overrides: { where: { date }, select: { type: true, substituteTeacherId: true } },
    },
  });
  const mine = entries.filter((e) => {
    const o = e.overrides[0];
    if (!o) return e.teacherId === t.id;
    if (o.type === "CANCELLED") return false;
    return o.substituteTeacherId === t.id; // substituted: only the substitute takes it
  });
  if (mine.length === 0) return { teacherId: t.id, timezone: inst.timezone, slots: [] };

  const [roster, marked] = await Promise.all([
    prisma.enrollment.groupBy({ by: ["divisionId"], where: { status: "ACTIVE", academicYearId: year.id, divisionId: { in: mine.map((e) => e.divisionId) } }, _count: { _all: true } }),
    prisma.attendance.groupBy({ by: ["timetableEntryId"], where: { date, timetableEntryId: { in: mine.map((e) => e.id) } }, _count: { _all: true } }),
  ]);
  const total = new Map(roster.map((r) => [r.divisionId, r._count._all]));
  const done = new Map(marked.map((r) => [r.timetableEntryId, r._count._all]));
  const slots = mine
    .sort((a, b) => a.period.sequence - b.period.sequence)
    .map((e): Slot => ({
      entryId: e.id, periodName: e.period.name, startTime: e.period.startTime, endTime: e.period.endTime, subject: e.subject.name,
      division: `${e.division.class.name} ${e.division.name}`, divisionId: e.divisionId,
      total: total.get(e.divisionId) ?? 0, marked: done.get(e.id) ?? 0, substitute: e.teacherId !== t.id,
    }));
  return { teacherId: t.id, timezone: inst.timezone, slots };
}

export interface RosterStudent { id: string; name: string; code: string; status: AttStatus | null }

export async function rosterFor(institutionId: string, divisionId: string, entryId: string, ymd: string): Promise<RosterStudent[]> {
  const year = await prisma.academicYear.findFirst({ where: { institutionId, status: "ACTIVE" }, select: { id: true } });
  if (!year) return [];
  const [enr, existing] = await Promise.all([
    prisma.enrollment.findMany({
      where: { status: "ACTIVE", academicYearId: year.id, divisionId },
      select: { student: { select: { id: true, studentCode: true, user: { select: { fullName: true } } } } },
    }),
    prisma.attendance.findMany({ where: { timetableEntryId: entryId, date: ymdToDate(ymd) }, select: { studentId: true, status: true } }),
  ]);
  const by = new Map(existing.map((a) => [a.studentId, a.status as AttStatus]));
  return enr
    .map((e) => ({ id: e.student.id, name: e.student.user.fullName, code: e.student.studentCode, status: by.get(e.student.id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Rosters for every class a teacher runs on a day, in two queries total, so switching periods needs no further trip to the server. */
export async function rostersForDay(slots: Slot[], ymd: string): Promise<Record<string, RosterStudent[]>> {
  if (slots.length === 0) return {};
  const date = ymdToDate(ymd);
  const [enr, existing] = await Promise.all([
    prisma.enrollment.findMany({
      where: { status: "ACTIVE", academicYear: { status: "ACTIVE" }, divisionId: { in: [...new Set(slots.map((x) => x.divisionId))] } },
      select: { divisionId: true, student: { select: { id: true, studentCode: true, user: { select: { fullName: true } } } } },
    }),
    prisma.attendance.findMany({ where: { date, timetableEntryId: { in: slots.map((x) => x.entryId) } }, select: { timetableEntryId: true, studentId: true, status: true } }),
  ]);
  const marks = new Map(existing.map((a) => [`${a.timetableEntryId}:${a.studentId}`, a.status as AttStatus]));
  const out: Record<string, RosterStudent[]> = {};
  for (const sl of slots) {
    out[sl.entryId] = enr
      .filter((e) => e.divisionId === sl.divisionId)
      .map((e) => ({ id: e.student.id, name: e.student.user.fullName, code: e.student.studentCode, status: marks.get(`${sl.entryId}:${e.student.id}`) ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

export interface StudentAttendance {
  hasProfile: boolean;
  total: number;
  counts: Record<AttStatus, number>;
  ratePct: number | null;
  bySubject: { subject: string; present: number; total: number; pct: number }[];
  recent: { id: string; date: string; period: string; subject: string; status: AttStatus }[];
  rows: { id: string; date: string; period: string; subject: string; status: AttStatus }[];
}

/** A student's own record for the last 90 days. Present, late and left-early count as attended; excused days are left out of the rate. */
export async function studentAttendance(userId: string): Promise<StudentAttendance> {
  const sp = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<AttStatus, number>;
  if (!sp) return { hasProfile: false, total: 0, counts, ratePct: null, bySubject: [], recent: [], rows: [] };
  const since = new Date(Date.now() - 90 * 86_400_000);
  const rows = await prisma.attendance.findMany({
    where: { studentId: sp.id, date: { gte: since } },
    orderBy: [{ date: "desc" }, { period: { sequence: "asc" } }],
    take: 500,
    select: { id: true, date: true, status: true, subject: { select: { name: true } }, period: { select: { name: true } } },
  });
  const subj = new Map<string, { present: number; total: number }>();
  for (const r of rows) {
    counts[r.status as AttStatus]++;
    if (r.status === "EXCUSED") continue;
    const s = subj.get(r.subject.name) ?? { present: 0, total: 0 };
    s.total++;
    if (r.status !== "ABSENT") s.present++;
    subj.set(r.subject.name, s);
  }
  const counted = rows.length - counts.EXCUSED;
  const attended = counted - counts.ABSENT;
  return {
    hasProfile: true,
    total: rows.length,
    counts,
    ratePct: counted > 0 ? Math.round((attended / counted) * 100) : null,
    bySubject: [...subj.entries()].map(([subject, v]) => ({ subject, ...v, pct: Math.round((v.present / v.total) * 100) })).sort((a, b) => a.pct - b.pct),
    rows: rows.map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), period: r.period.name, subject: r.subject.name, status: r.status as AttStatus })),
    recent: rows.slice(0, 40).map((r) => ({ id: r.id, date: r.date.toISOString().slice(0, 10), period: r.period.name, subject: r.subject.name, status: r.status as AttStatus })),
  };
}
