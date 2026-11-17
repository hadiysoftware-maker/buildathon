"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { periodsOverlap, validPeriodTimes } from "@/lib/timetable/schedule";
import { action, UserError } from "../shared";
import type { FormValues } from "../types";

const A = "academic.manage" as const;
const PATH = "/admin/academic";

const str = (max: number, label: string) => z.string().trim().min(1, `${label} is required`).max(max);
const optStr = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const int = (label: string, min = 0, max = 10000) =>
  z.coerce.number({ error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max);
const date = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required`).transform((v) => new Date(`${v}T00:00:00Z`));

async function mustOwn(model: "department" | "course" | "class" | "division" | "classroom" | "subject" | "academicYear", id: string, institutionId: string) {
  // @ts-expect-error — dynamic delegate; all models above have institutionId (division/class checked via the column too)
  const found = await prisma[model].findFirst({ where: { id, institutionId }, select: { id: true } });
  if (!found) throw new UserError("Selected record was not found.");
}

// ── Academic years ──────────────────────────────────────────────
const YearSchema = z
  .object({ name: str(40, "Name"), startDate: date("Start date"), endDate: date("End date") })
  .refine((v) => v.endDate > v.startDate, { message: "End date must be after the start date" });

export async function createAcademicYear(v: FormValues) {
  return action(A, async (s) => {
    const d = YearSchema.parse(v);
    const row = await prisma.academicYear.create({ data: { ...d, institutionId: s.institutionId } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "academicYear.create", entityType: "AcademicYear", entityId: row.id });
  }, [`${PATH}/years`]);
}

/** Exactly one active year: activating archives the previously active one (history is kept). */
export async function activateAcademicYear(id: string) {
  return action(A, async (s) => {
    await mustOwn("academicYear", id, s.institutionId);
    await prisma.$transaction([
      prisma.academicYear.updateMany({ where: { institutionId: s.institutionId, status: "ACTIVE", NOT: { id } }, data: { status: "ARCHIVED" } }),
      prisma.academicYear.update({ where: { id }, data: { status: "ACTIVE" } }),
    ]);
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "academicYear.activate", entityType: "AcademicYear", entityId: id });
  }, [`${PATH}/years`]);
}

export async function archiveAcademicYear(id: string) {
  return action(A, async (s) => {
    await mustOwn("academicYear", id, s.institutionId);
    await prisma.academicYear.update({ where: { id }, data: { status: "ARCHIVED" } });
  }, [`${PATH}/years`]);
}

// ── Departments ─────────────────────────────────────────────────
const DeptSchema = z.object({ code: str(20, "Code").toUpperCase(), name: str(120, "Name"), headTeacherId: optStr(30) });

export async function createDepartment(v: FormValues) {
  return action(A, async (s) => {
    const d = DeptSchema.parse(v);
    await prisma.department.create({ data: { ...d, institutionId: s.institutionId } });
  }, [`${PATH}/departments`]);
}
export async function updateDepartment(id: string, v: FormValues) {
  return action(A, async (s) => {
    const d = DeptSchema.omit({ code: true }).parse(v);
    await mustOwn("department", id, s.institutionId);
    await prisma.department.update({ where: { id }, data: { name: d.name, headTeacherId: d.headTeacherId ?? null } });
  }, [`${PATH}/departments`]);
}
export async function archiveDepartment(id: string) {
  return action(A, async (s) => {
    await mustOwn("department", id, s.institutionId);
    await prisma.department.update({ where: { id }, data: { archivedAt: new Date() } });
  }, [`${PATH}/departments`]);
}

// ── Courses ─────────────────────────────────────────────────────
const CourseSchema = z.object({ code: str(20, "Code").toUpperCase(), name: str(160, "Name"), departmentId: str(30, "Department"), durationYears: int("Duration", 1, 8) });

export async function createCourse(v: FormValues) {
  return action(A, async (s) => {
    const d = CourseSchema.parse(v);
    await mustOwn("department", d.departmentId, s.institutionId);
    await prisma.course.create({ data: { ...d, institutionId: s.institutionId } });
  }, [`${PATH}/courses`]);
}
export async function updateCourse(id: string, v: FormValues) {
  return action(A, async (s) => {
    const d = CourseSchema.omit({ code: true }).parse(v);
    await mustOwn("course", id, s.institutionId);
    await mustOwn("department", d.departmentId, s.institutionId);
    await prisma.course.update({ where: { id }, data: d });
  }, [`${PATH}/courses`]);
}
export async function archiveCourse(id: string) {
  return action(A, async (s) => {
    await mustOwn("course", id, s.institutionId);
    await prisma.course.update({ where: { id }, data: { archivedAt: new Date() } });
  }, [`${PATH}/courses`]);
}

// ── Classes & divisions ─────────────────────────────────────────
const ClassSchema = z.object({
  name: str(120, "Name"),
  courseId: str(30, "Course"),
  academicYearId: str(30, "Academic year"),
  yearLevel: int("Year level", 1, 8),
  firstDivision: optStr(20),
  capacity: int("Capacity", 1, 500).default(60),
});

export async function createClass(v: FormValues) {
  return action(A, async (s) => {
    const d = ClassSchema.parse(v);
    await mustOwn("course", d.courseId, s.institutionId);
    await mustOwn("academicYear", d.academicYearId, s.institutionId);
    await prisma.$transaction(async (tx) => {
      const cls = await tx.class.create({
        data: { institutionId: s.institutionId, name: d.name, courseId: d.courseId, academicYearId: d.academicYearId, yearLevel: d.yearLevel },
      });
      if (d.firstDivision) {
        await tx.division.create({ data: { institutionId: s.institutionId, classId: cls.id, name: d.firstDivision, capacity: d.capacity } });
      }
    });
  }, [`${PATH}/classes`]);
}
export async function archiveClass(id: string) {
  return action(A, async (s) => {
    await mustOwn("class", id, s.institutionId);
    await prisma.class.update({ where: { id }, data: { archivedAt: new Date() } });
  }, [`${PATH}/classes`]);
}

const DivisionSchema = z.object({
  classId: str(30, "Class"),
  name: str(20, "Division"),
  capacity: int("Capacity", 1, 500),
  classTeacherId: optStr(30),
  classroomId: optStr(30),
});
export async function createDivision(v: FormValues) {
  return action(A, async (s) => {
    const d = DivisionSchema.parse(v);
    await mustOwn("class", d.classId, s.institutionId);
    if (d.classroomId) await mustOwn("classroom", d.classroomId, s.institutionId);
    await prisma.division.create({ data: { ...d, institutionId: s.institutionId } });
  }, [`${PATH}/classes`]);
}
export async function updateDivision(id: string, v: FormValues) {
  return action(A, async (s) => {
    const d = DivisionSchema.omit({ classId: true, name: true }).parse(v);
    await mustOwn("division", id, s.institutionId);
    if (d.classroomId) await mustOwn("classroom", d.classroomId, s.institutionId);
    await prisma.division.update({ where: { id }, data: { capacity: d.capacity, classTeacherId: d.classTeacherId ?? null, classroomId: d.classroomId ?? null } });
  }, [`${PATH}/classes`]);
}
export async function archiveDivision(id: string) {
  return action(A, async (s) => {
    await mustOwn("division", id, s.institutionId);
    await prisma.division.update({ where: { id }, data: { archivedAt: new Date() } });
  }, [`${PATH}/classes`]);
}

// ── Classrooms ──────────────────────────────────────────────────
const RoomSchema = z.object({ code: str(20, "Code").toUpperCase(), name: str(120, "Name"), building: optStr(120), capacity: int("Capacity", 1, 1000), hasSmartBoard: z.string().optional().transform((v) => v === "true") });
export async function createClassroom(v: FormValues) {
  return action(A, async (s) => {
    await prisma.classroom.create({ data: { ...RoomSchema.parse(v), institutionId: s.institutionId } });
  }, [`${PATH}/classrooms`]);
}
export async function updateClassroom(id: string, v: FormValues) {
  return action(A, async (s) => {
    const d = RoomSchema.omit({ code: true }).parse(v);
    await mustOwn("classroom", id, s.institutionId);
    await prisma.classroom.update({ where: { id }, data: d });
  }, [`${PATH}/classrooms`]);
}
export async function archiveClassroom(id: string) {
  return action(A, async (s) => {
    await mustOwn("classroom", id, s.institutionId);
    await prisma.classroom.update({ where: { id }, data: { archivedAt: new Date() } });
  }, [`${PATH}/classrooms`]);
}

// ── Subjects ────────────────────────────────────────────────────
const SubjectSchema = z.object({
  code: str(20, "Code").toUpperCase(),
  name: str(160, "Name"),
  departmentId: optStr(30),
  type: z.enum(["THEORY", "PRACTICAL", "BOTH"]),
  credits: z.coerce.number().min(0).max(30).default(0),
  periodsPerWeek: int("Periods per week", 1, 40),
});
export async function createSubject(v: FormValues) {
  return action(A, async (s) => {
    const d = SubjectSchema.parse(v);
    if (d.departmentId) await mustOwn("department", d.departmentId, s.institutionId);
    await prisma.subject.create({ data: { ...d, institutionId: s.institutionId } });
  }, [`${PATH}/subjects`]);
}
export async function updateSubject(id: string, v: FormValues) {
  return action(A, async (s) => {
    const d = SubjectSchema.omit({ code: true }).parse(v);
    await mustOwn("subject", id, s.institutionId);
    if (d.departmentId) await mustOwn("department", d.departmentId, s.institutionId);
    await prisma.subject.update({ where: { id }, data: { ...d, departmentId: d.departmentId ?? null } });
  }, [`${PATH}/subjects`]);
}
export async function archiveSubject(id: string) {
  return action(A, async (s) => {
    await mustOwn("subject", id, s.institutionId);
    await prisma.subject.update({ where: { id }, data: { archivedAt: new Date() } });
  }, [`${PATH}/subjects`]);
}

// ── Periods ─────────────────────────────────────────────────────
const PeriodSchema = z.object({
  name: str(40, "Name"),
  sequence: int("Order", 1, 30),
  startTime: z.string(),
  endTime: z.string(),
  kind: z.enum(["CLASS", "BREAK", "LUNCH"]),
});

async function assertPeriodFits(institutionId: string, p: z.infer<typeof PeriodSchema>, ignoreId?: string) {
  if (!validPeriodTimes(p.startTime, p.endTime)) throw new UserError("Enter valid start and end times (end after start).");
  const others = await prisma.period.findMany({ where: { institutionId, archivedAt: null, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) } });
  const clash = others.find((o) => periodsOverlap(o, p));
  if (clash) throw new UserError(`Overlaps with "${clash.name}" (${clash.startTime}–${clash.endTime}).`);
}

export async function createPeriod(v: FormValues) {
  return action(A, async (s) => {
    const d = PeriodSchema.parse(v);
    await assertPeriodFits(s.institutionId, d);
    await prisma.period.create({ data: { ...d, institutionId: s.institutionId } });
  }, [`${PATH}/periods`, `${PATH}/timetable`]);
}
export async function updatePeriod(id: string, v: FormValues) {
  return action(A, async (s) => {
    const d = PeriodSchema.omit({ sequence: true }).parse(v);
    const existing = await prisma.period.findFirst({ where: { id, institutionId: s.institutionId } });
    if (!existing) throw new UserError("Period not found.");
    await assertPeriodFits(s.institutionId, { ...d, sequence: existing.sequence }, id);
    await prisma.period.update({ where: { id }, data: d });
  }, [`${PATH}/periods`, `${PATH}/timetable`]);
}
export async function archivePeriod(id: string) {
  return action(A, async (s) => {
    const used = await prisma.timetableEntry.count({ where: { periodId: id, institutionId: s.institutionId, status: "ACTIVE" } });
    if (used > 0) throw new UserError("This period is used in the timetable. Remove those entries first.");
    const existing = await prisma.period.findFirst({ where: { id, institutionId: s.institutionId } });
    if (!existing) throw new UserError("Period not found.");
    // Free the unique sequence slot so a replacement period can reuse it; the row is kept for history.
    await prisma.period.update({ where: { id }, data: { archivedAt: new Date(), sequence: -Math.floor(Date.now() / 1000) } });
  }, [`${PATH}/periods`, `${PATH}/timetable`]);
}

// ── Teacher assignment ──────────────────────────────────────────
const AssignSchema = z.object({ divisionId: str(30, "Class"), subjectId: str(30, "Subject"), teacherId: str(30, "Teacher") });
export async function assignTeacher(v: FormValues) {
  return action(A, async (s) => {
    const d = AssignSchema.parse(v);
    const division = await prisma.division.findFirst({ where: { id: d.divisionId, institutionId: s.institutionId }, include: { class: true } });
    if (!division) throw new UserError("Class not found.");
    await mustOwn("subject", d.subjectId, s.institutionId);
    const teacher = await prisma.teacherProfile.findFirst({ where: { id: d.teacherId, institutionId: s.institutionId } });
    if (!teacher) throw new UserError("Teacher not found.");
    await prisma.teacherAssignment.upsert({
      where: { divisionId_subjectId: { divisionId: d.divisionId, subjectId: d.subjectId } },
      create: { ...d, academicYearId: division.class.academicYearId },
      update: { teacherId: d.teacherId },
    });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "teacher.assign", entityType: "TeacherAssignment", metadata: d });
  }, [`${PATH}/classes`, `${PATH}/timetable`]);
}
export async function removeTeacherAssignment(id: string) {
  return action(A, async (s) => {
    const a = await prisma.teacherAssignment.findFirst({ where: { id, division: { institutionId: s.institutionId } } });
    if (!a) throw new UserError("Assignment not found.");
    await prisma.teacherAssignment.delete({ where: { id } });
  }, [`${PATH}/classes`]);
}
