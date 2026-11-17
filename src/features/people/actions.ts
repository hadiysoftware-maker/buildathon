"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { issueCredential } from "@/lib/auth/smart-id";
import { revokeUserSessions } from "@/lib/auth/session";
import { parseCsvObjects } from "@/lib/csv";
import { action, UserError } from "../shared";
import { withUniqueCode } from "./codes";
import { buildCardView, type CardView } from "../smart-id/card";
import type { FormValues } from "../types";

const optStr = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const req = (max: number, label: string) => z.string().trim().min(1, `${label} is required`).max(max);
const optDate = z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : undefined));
const optEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => v || undefined)
  .pipe(z.string().email("Enter a valid email").max(191).optional());

const StudentSchema = z.object({
  fullName: req(160, "Full name"),
  email: optEmail,
  phone: optStr(32),
  dateOfBirth: optDate,
  guardianName: optStr(160),
  guardianPhone: optStr(32),
  guardianRelation: optStr(40),
  departmentId: optStr(30),
  courseId: optStr(30),
  divisionId: optStr(30),
  rollNumber: z.string().optional().transform((v) => (v ? Number(v) : undefined)).pipe(z.number().int().min(1).max(9999).optional()),
  admissionDate: optDate,
  admissionNumber: optStr(40),
  issueCard: z.string().optional().transform((v) => v !== "false"),
});

const TeacherSchema = z.object({
  fullName: req(160, "Full name"),
  email: optEmail,
  phone: optStr(32),
  employeeId: req(40, "Employee ID"),
  departmentId: optStr(30),
  qualification: optStr(160),
  designation: optStr(120),
  specialization: optStr(160),
  issueCard: z.string().optional().transform((v) => v !== "false"),
});

async function roleId(institutionId: string, key: "STUDENT" | "TEACHER") {
  const r = await prisma.role.findUnique({ where: { institutionId_key: { institutionId, key } } });
  if (!r) throw new UserError("Roles are not set up. Run the database seed.");
  return r.id;
}

async function enrollInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  institutionId: string,
  studentId: string,
  divisionId: string,
  rollNumber?: number,
) {
  const division = await tx.division.findFirst({ where: { id: divisionId, institutionId, archivedAt: null }, include: { class: true } });
  if (!division) throw new UserError("Selected class division was not found.");
  const active = await tx.enrollment.count({ where: { divisionId, status: "ACTIVE" } });
  if (active >= division.capacity) throw new UserError(`Division ${division.name} is full (capacity ${division.capacity}).`);
  let roll = rollNumber;
  if (!roll) {
    const max = await tx.enrollment.aggregate({ where: { divisionId }, _max: { rollNumber: true } });
    roll = (max._max.rollNumber ?? 0) + 1;
  }
  await tx.enrollment.create({ data: { studentId, divisionId, academicYearId: division.class.academicYearId, rollNumber: roll } });
}

export interface CreatedPerson {
  userId: string;
  card?: CardView;
}

export async function createStudent(v: FormValues) {
  return action<CreatedPerson>("students.manage", async (s) => {
    const d = StudentSchema.parse(v);
    const rid = await roleId(s.institutionId, "STUDENT");
    const userId = await withUniqueCode("S", (code) =>
      prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            institutionId: s.institutionId, fullName: d.fullName, email: d.email,
            roles: { create: { roleId: rid } },
            student: {
              create: {
                institutionId: s.institutionId, studentCode: code, admissionNumber: d.admissionNumber ?? code.replace("S", "ADM"),
                phone: d.phone, dateOfBirth: d.dateOfBirth, guardianName: d.guardianName, guardianPhone: d.guardianPhone,
                guardianRelation: d.guardianRelation, departmentId: d.departmentId, courseId: d.courseId, admissionDate: d.admissionDate,
              },
            },
          },
          include: { student: true },
        });
        await tx.studentPortfolio.create({ data: { studentId: user.student!.id } });
        if (d.divisionId) await enrollInTx(tx, s.institutionId, user.student!.id, d.divisionId, d.rollNumber);
        return user.id;
      }),
    );
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "student.create", entityType: "User", entityId: userId });
    if (!d.issueCard) return { userId };
    const c = await issueCredential({ institutionId: s.institutionId, userId, issuedById: s.userId });
    return { userId, card: await buildCardView(userId, c.credentialId, c.payload) };
  }, ["/admin/people/students", "/admin/smart-id"]);
}

export async function updateStudent(userId: string, v: FormValues) {
  return action("students.manage", async (s) => {
    const d = StudentSchema.omit({ issueCard: true, divisionId: true, rollNumber: true, admissionNumber: true }).parse(v);
    const u = await prisma.user.findFirst({ where: { id: userId, institutionId: s.institutionId, student: { isNot: null } } });
    if (!u) throw new UserError("Student not found.");
    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: d.fullName, email: d.email ?? null,
        student: { update: { phone: d.phone ?? null, dateOfBirth: d.dateOfBirth ?? null, guardianName: d.guardianName ?? null, guardianPhone: d.guardianPhone ?? null, guardianRelation: d.guardianRelation ?? null, departmentId: d.departmentId ?? null, courseId: d.courseId ?? null, admissionDate: d.admissionDate ?? null } },
      },
    });
  }, ["/admin/people/students"]);
}

/** Move a student to another division; the old enrollment is kept as TRANSFERRED history. */
export async function transferStudent(userId: string, divisionId: string) {
  return action("students.manage", async (s) => {
    const st = await prisma.studentProfile.findFirst({ where: { userId, institutionId: s.institutionId } });
    if (!st) throw new UserError("Student not found.");
    await prisma.$transaction(async (tx) => {
      await tx.enrollment.updateMany({ where: { studentId: st.id, status: "ACTIVE" }, data: { status: "TRANSFERRED", endedAt: new Date() } });
      await enrollInTx(tx, s.institutionId, st.id, divisionId);
    });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "student.transfer", entityType: "User", entityId: userId, metadata: { divisionId } });
  }, ["/admin/people/students"]);
}

async function setStatus(institutionId: string, actorId: string, userId: string, status: "ACTIVE" | "INACTIVE" | "ARCHIVED", kind: "student" | "teacher") {
  const u = await prisma.user.findFirst({ where: { id: userId, institutionId, [kind]: { isNot: null } } });
  if (!u) throw new UserError("Person not found.");
  await prisma.user.update({ where: { id: userId }, data: { status, archivedAt: status === "ARCHIVED" ? new Date() : null } });
  if (status !== "ACTIVE") await revokeUserSessions(userId, `ACCOUNT_${status}`);
  await audit({ institutionId, actorId, action: `${kind}.${status.toLowerCase()}`, entityType: "User", entityId: userId });
}

export async function setStudentStatus(userId: string, status: "ACTIVE" | "INACTIVE" | "ARCHIVED") {
  return action("students.manage", (s) => setStatus(s.institutionId, s.userId, userId, status, "student"), ["/admin/people/students"]);
}
export async function setTeacherStatus(userId: string, status: "ACTIVE" | "INACTIVE" | "ARCHIVED") {
  return action("teachers.manage", (s) => setStatus(s.institutionId, s.userId, userId, status, "teacher"), ["/admin/people/teachers"]);
}

export async function createTeacher(v: FormValues) {
  return action<CreatedPerson>("teachers.manage", async (s) => {
    const d = TeacherSchema.parse(v);
    const rid = await roleId(s.institutionId, "TEACHER");
    const userId = await withUniqueCode("T", async (code) => {
      const user = await prisma.user.create({
        data: {
          institutionId: s.institutionId, fullName: d.fullName, email: d.email,
          roles: { create: { roleId: rid } },
          teacher: { create: { institutionId: s.institutionId, teacherCode: code, employeeId: d.employeeId, phone: d.phone, departmentId: d.departmentId, qualification: d.qualification, designation: d.designation, specialization: d.specialization } },
        },
      });
      return user.id;
    });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "teacher.create", entityType: "User", entityId: userId });
    if (!d.issueCard) return { userId };
    const c = await issueCredential({ institutionId: s.institutionId, userId, issuedById: s.userId });
    return { userId, card: await buildCardView(userId, c.credentialId, c.payload) };
  }, ["/admin/people/teachers", "/admin/smart-id"]);
}

export async function updateTeacher(userId: string, v: FormValues) {
  return action("teachers.manage", async (s) => {
    const d = TeacherSchema.omit({ issueCard: true, employeeId: true }).parse(v);
    const u = await prisma.user.findFirst({ where: { id: userId, institutionId: s.institutionId, teacher: { isNot: null } } });
    if (!u) throw new UserError("Teacher not found.");
    await prisma.user.update({
      where: { id: userId },
      data: { fullName: d.fullName, email: d.email ?? null, teacher: { update: { phone: d.phone ?? null, departmentId: d.departmentId ?? null, qualification: d.qualification ?? null, designation: d.designation ?? null, specialization: d.specialization ?? null } } },
    });
  }, ["/admin/people/teachers"]);
}

// ── CSV import ──────────────────────────────────────────────────
export interface ImportSummary {
  created: number;
  errors: { row: number; message: string }[];
}

const MAX_IMPORT_ROWS = 500;

export async function importStudentsCsv(csv: string) {
  return action<ImportSummary>("students.manage", async (s) => {
    const rows = parseCsvObjects(csv);
    if (rows.length > MAX_IMPORT_ROWS) throw new UserError(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
    const [depts, courses] = await Promise.all([
      prisma.department.findMany({ where: { institutionId: s.institutionId } }),
      prisma.course.findMany({ where: { institutionId: s.institutionId } }),
    ]);
    const summary: ImportSummary = { created: 0, errors: [] };
    for (const [i, r] of rows.entries()) {
      const dept = depts.find((d) => d.code.toLowerCase() === (r.departmentcode ?? "").toLowerCase());
      const course = courses.find((c) => c.code.toLowerCase() === (r.coursecode ?? "").toLowerCase());
      const res = await createStudent({
        fullName: r.fullname ?? "", email: r.email ?? "", phone: r.phone ?? "", dateOfBirth: r.dateofbirth ?? "",
        guardianName: r.guardianname ?? "", guardianPhone: r.guardianphone ?? "", admissionNumber: r.admissionnumber ?? "",
        departmentId: dept?.id ?? "", courseId: course?.id ?? "", issueCard: "false",
      });
      if (res.ok) summary.created++;
      else summary.errors.push({ row: i + 2, message: res.error });
    }
    return summary;
  }, ["/admin/people/students"]);
}

export async function importTeachersCsv(csv: string) {
  return action<ImportSummary>("teachers.manage", async (s) => {
    const rows = parseCsvObjects(csv);
    if (rows.length > MAX_IMPORT_ROWS) throw new UserError(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
    const depts = await prisma.department.findMany({ where: { institutionId: s.institutionId } });
    const summary: ImportSummary = { created: 0, errors: [] };
    for (const [i, r] of rows.entries()) {
      const dept = depts.find((d) => d.code.toLowerCase() === (r.departmentcode ?? "").toLowerCase());
      const res = await createTeacher({
        fullName: r.fullname ?? "", email: r.email ?? "", phone: r.phone ?? "", employeeId: r.employeeid ?? "",
        qualification: r.qualification ?? "", designation: r.designation ?? "", specialization: r.specialization ?? "",
        departmentId: dept?.id ?? "", issueCard: "false",
      });
      if (res.ok) summary.created++;
      else summary.errors.push({ row: i + 2, message: res.error });
    }
    return summary;
  }, ["/admin/people/teachers"]);
}
