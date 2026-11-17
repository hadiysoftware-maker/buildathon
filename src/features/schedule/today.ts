import "server-only";
import { prisma } from "@/lib/db";
import { classifyPeriod, nowInZone, type PeriodStatus } from "@/lib/timetable/schedule";

export interface ScheduleRow {
  key: string;
  periodName: string;
  startTime: string;
  endTime: string;
  kind: "CLASS" | "BREAK" | "LUNCH";
  status: PeriodStatus;
  subject: string | null;
  teacher: string | null;
  classroom: string | null;
  division: string | null;
  note: string | null;
}

export interface DaySchedule {
  dayOfWeek: number;
  dateLabel: string;
  timezone: string;
  rows: ScheduleRow[];
  current: ScheduleRow | null;
  next: ScheduleRow | null;
  hasYear: boolean;
}

/** Today's date in the institution's timezone as a UTC-midnight Date (matches the @db.Date override column). */
const tzCache = new Map<string, { tz: string; at: number }>();
/** The school's time zone almost never changes, so it is remembered for 10 minutes instead of being read on every page. */
export async function institutionTimezone(id: string): Promise<string> {
  const hit = tzCache.get(id);
  if (hit && Date.now() - hit.at < 600_000) return hit.tz;
  const r = await prisma.institution.findUniqueOrThrow({ where: { id }, select: { timezone: true } });
  tzCache.set(id, { tz: r.timezone, at: Date.now() });
  return r.timezone;
}

function zonedDate(timeZone: string, now: Date) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { date: new Date(`${ymd}T00:00:00Z`), label: new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(now) };
}

/**
 * The real timetable for today, honouring cancellations and substitutions.
 * `who` selects whose timetable: a student (by their active division) or a teacher.
 */
export async function getDaySchedule(input: { institutionId: string; userId: string; who: "student" | "teacher" }): Promise<DaySchedule> {
  const inst = { timezone: await institutionTimezone(input.institutionId) };
  const now = new Date();
  const { dayOfWeek, minutes } = nowInZone(inst.timezone, now);
  const { date, label } = zonedDate(inst.timezone, now);

  // The year, the periods and "who is asking" are independent, so they are fetched together (one round trip instead of three).
  const [year, periods, enr, teacher] = await Promise.all([
    prisma.academicYear.findFirst({ where: { institutionId: input.institutionId, status: "ACTIVE" }, select: { id: true } }),
    prisma.period.findMany({ where: { institutionId: input.institutionId, archivedAt: null }, orderBy: { sequence: "asc" } }),
    input.who === "student"
      ? prisma.enrollment.findFirst({ where: { status: "ACTIVE", academicYear: { status: "ACTIVE" }, student: { userId: input.userId } }, select: { divisionId: true } })
      : Promise.resolve(null),
    input.who === "teacher" ? prisma.teacherProfile.findUnique({ where: { userId: input.userId }, select: { id: true } }) : Promise.resolve(null),
  ]);
  const empty: DaySchedule = { dayOfWeek, dateLabel: label, timezone: inst.timezone, rows: [], current: null, next: null, hasYear: !!year };
  if (!year) return empty;

  const include = {
    subject: { select: { name: true } },
    teacher: { include: { user: { select: { fullName: true } } } },
    classroom: { select: { name: true } },
    division: { include: { class: { select: { name: true } } } },
    overrides: { where: { date }, include: { substituteTeacher: { include: { user: { select: { fullName: true } } } } } },
  } as const;

  let entries;
  let myTeacherId: string | null = null;
  if (input.who === "student") {
    if (!enr) return empty;
    entries = await prisma.timetableEntry.findMany({ where: { academicYearId: year.id, divisionId: enr.divisionId, dayOfWeek, status: "ACTIVE" }, include });
  } else {
    const t = teacher;
    if (!t) return empty;
    myTeacherId = t.id;
    entries = await prisma.timetableEntry.findMany({
      where: {
        academicYearId: year.id, dayOfWeek, status: "ACTIVE",
        OR: [{ teacherId: t.id }, { overrides: { some: { date, type: "SUBSTITUTED", substituteTeacherId: t.id } } }],
      },
      include,
    });
  }

  const byPeriod = new Map(entries.map((e) => [e.periodId, e]));
  const rows: ScheduleRow[] = [];
  for (const p of periods) {
    const e = byPeriod.get(p.id);
    if (p.kind !== "CLASS") {
      rows.push({ key: p.id, periodName: p.name, startTime: p.startTime, endTime: p.endTime, kind: p.kind, status: classifyPeriod(p, minutes), subject: null, teacher: null, classroom: null, division: null, note: null });
      continue;
    }
    if (!e) continue; // free period: nothing scheduled
    const o = e.overrides[0];
    const cancelled = o?.type === "CANCELLED";
    const substitute = o?.type === "SUBSTITUTED" ? o.substituteTeacher?.user.fullName ?? null : null;
    // A teacher whose class is covered by someone else no longer teaches it.
    if (input.who === "teacher" && o?.type === "SUBSTITUTED" && o.substituteTeacherId !== e.teacherId) {
      if (myTeacherId && o.substituteTeacherId !== myTeacherId) continue;
    }
    rows.push({
      key: e.id,
      periodName: p.name, startTime: p.startTime, endTime: p.endTime, kind: p.kind,
      status: classifyPeriod(p, minutes, cancelled),
      subject: e.subject.name,
      teacher: substitute ?? e.teacher.user.fullName,
      classroom: e.classroom?.name ?? null,
      division: `${e.division.class.name} · ${e.division.name}`,
      note: cancelled ? (o?.reason ?? "Cancelled") : substitute ? `Substitute for ${e.teacher.user.fullName}` : null,
    });
  }

  const current = rows.find((r) => r.status === "current") ?? null;
  const next = rows.find((r) => r.status === "upcoming") ?? null;
  return { ...empty, rows, current, next };
}
