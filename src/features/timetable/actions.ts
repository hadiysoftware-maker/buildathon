"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { detectConflicts, type Conflict } from "@/lib/timetable/conflicts";
import { action, UserError } from "../shared";

const T = "timetable.manage" as const;
const PATHS = ["/admin/academic/timetable", "/teacher", "/student"];

const SlotSchema = z.object({
  divisionId: z.string().min(1).max(30),
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  periodId: z.string().min(1).max(30),
  subjectId: z.string().min(1).max(30),
  teacherId: z.string().min(1).max(30),
  classroomId: z.string().max(30).optional().transform((v) => v || undefined),
});

export type SetSlotResult = { conflicts: Conflict[] } | { saved: true };

/** Create or replace the entry for (division, day, period). Conflicts are returned, never silently saved. */
export async function setTimetableEntry(v: Record<string, string>) {
  return action<SetSlotResult>(T, async (s) => {
    const d = SlotSchema.parse(v);
    const division = await prisma.division.findFirst({ where: { id: d.divisionId, institutionId: s.institutionId, archivedAt: null }, include: { class: true } });
    if (!division) throw new UserError("Class not found.");
    const [period, subject, teacher, room] = await Promise.all([
      prisma.period.findFirst({ where: { id: d.periodId, institutionId: s.institutionId, archivedAt: null } }),
      prisma.subject.findFirst({ where: { id: d.subjectId, institutionId: s.institutionId, archivedAt: null } }),
      prisma.teacherProfile.findFirst({ where: { id: d.teacherId, institutionId: s.institutionId, user: { status: "ACTIVE" } } }),
      d.classroomId ? prisma.classroom.findFirst({ where: { id: d.classroomId, institutionId: s.institutionId, archivedAt: null } }) : null,
    ]);
    if (!period || !subject || !teacher || (d.classroomId && !room)) throw new UserError("A selected item was not found.");
    if (period.kind !== "CLASS") throw new UserError("Classes cannot be scheduled in a break.");

    const yearId = division.class.academicYearId;
    const existing = await prisma.timetableEntry.findMany({
      where: { institutionId: s.institutionId, academicYearId: yearId, status: "ACTIVE" },
      select: { id: true, divisionId: true, dayOfWeek: true, periodId: true, subjectId: true, teacherId: true, classroomId: true },
    });
    const current = existing.find((e) => e.divisionId === d.divisionId && e.dayOfWeek === d.dayOfWeek && e.periodId === d.periodId);
    const assigned = await prisma.teacherAssignment.findUnique({ where: { divisionId_subjectId: { divisionId: d.divisionId, subjectId: d.subjectId } } });
    const conflicts = detectConflicts({ ...d, id: current?.id }, existing, { periodsPerWeek: assigned?.periodsPerWeek ?? subject.periodsPerWeek });
    if (conflicts.length) return { conflicts };

    await prisma.timetableEntry.upsert({
      where: { divisionId_dayOfWeek_periodId: { divisionId: d.divisionId, dayOfWeek: d.dayOfWeek, periodId: d.periodId } },
      create: { ...d, institutionId: s.institutionId, academicYearId: yearId },
      update: { subjectId: d.subjectId, teacherId: d.teacherId, classroomId: d.classroomId ?? null, status: "ACTIVE" },
    });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "timetable.set", entityType: "TimetableEntry", metadata: d });
    return { saved: true as const };
  }, PATHS);
}

export async function removeTimetableEntry(id: string) {
  return action(T, async (s) => {
    const e = await prisma.timetableEntry.findFirst({ where: { id, institutionId: s.institutionId }, include: { _count: { select: { sessions: true, attendance: true } } } });
    if (!e) throw new UserError("Entry not found.");
    // Entries that already hold classroom history are cancelled, not deleted, to preserve records.
    if (e._count.sessions + e._count.attendance > 0) await prisma.timetableEntry.update({ where: { id }, data: { status: "CANCELLED" } });
    else await prisma.timetableEntry.delete({ where: { id } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "timetable.remove", entityType: "TimetableEntry", entityId: id });
  }, PATHS);
}

/** Cancel a single date, or substitute the teacher for that date, without altering the weekly pattern. */
export async function overrideTimetableEntry(v: Record<string, string>) {
  return action(T, async (s) => {
    const d = z
      .object({
        entryId: z.string().max(30),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        type: z.enum(["CANCELLED", "SUBSTITUTED"]),
        substituteTeacherId: z.string().max(30).optional().transform((x) => x || undefined),
        reason: z.string().max(255).optional(),
      })
      .refine((x) => x.type === "CANCELLED" || !!x.substituteTeacherId, { message: "Choose a substitute teacher" })
      .parse(v);
    const entry = await prisma.timetableEntry.findFirst({ where: { id: d.entryId, institutionId: s.institutionId } });
    if (!entry) throw new UserError("Entry not found.");
    const date = new Date(`${d.date}T00:00:00Z`);
    const data = { type: d.type, substituteTeacherId: d.substituteTeacherId ?? null, reason: d.reason ?? null, createdById: s.userId };
    await prisma.timetableOverride.upsert({ where: { entryId_date: { entryId: d.entryId, date } }, create: { entryId: d.entryId, date, ...data }, update: data });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: `timetable.${d.type.toLowerCase()}`, entityType: "TimetableEntry", entityId: d.entryId, metadata: { date: d.date } });
  }, PATHS);
}

/** Copy the weekly pattern to another division, skipping slots that would clash. Reports what was skipped. */
export async function copyTimetable(fromDivisionId: string, toDivisionId: string) {
  return action<{ copied: number; skipped: number }>(T, async (s) => {
    if (fromDivisionId === toDivisionId) throw new UserError("Choose two different classes.");
    const [from, to] = await Promise.all([
      prisma.division.findFirst({ where: { id: fromDivisionId, institutionId: s.institutionId } }),
      prisma.division.findFirst({ where: { id: toDivisionId, institutionId: s.institutionId }, include: { class: true } }),
    ]);
    if (!from || !to) throw new UserError("Class not found.");
    const source = await prisma.timetableEntry.findMany({ where: { divisionId: fromDivisionId, status: "ACTIVE" } });
    const all = await prisma.timetableEntry.findMany({
      where: { institutionId: s.institutionId, academicYearId: to.class.academicYearId, status: "ACTIVE" },
      select: { id: true, divisionId: true, dayOfWeek: true, periodId: true, subjectId: true, teacherId: true, classroomId: true },
    });
    let copied = 0;
    let skipped = 0;
    for (const e of source) {
      // The copy keeps teacher and subject, but never the room: rooms are per division.
      const cand = { divisionId: toDivisionId, dayOfWeek: e.dayOfWeek, periodId: e.periodId, subjectId: e.subjectId, teacherId: e.teacherId, classroomId: to.classroomId };
      if (detectConflicts(cand, all).length) { skipped++; continue; }
      const row = await prisma.timetableEntry.create({ data: { ...cand, institutionId: s.institutionId, academicYearId: to.class.academicYearId } });
      all.push({ id: row.id, ...cand });
      copied++;
    }
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "timetable.copy", entityType: "Division", entityId: toDivisionId, metadata: { fromDivisionId, copied, skipped } });
    return { copied, skipped };
  }, PATHS);
}
