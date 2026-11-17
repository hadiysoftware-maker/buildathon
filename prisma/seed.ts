/**
 * Seed for EduCore.
 *
 *   npm run db:seed                 → institution, roles, permissions, settings, default periods (idempotent)
 *   SEED_DEMO=true npm run db:seed  → additionally a small, clearly-labelled DEMO academic structure
 *
 * Demo rows are named "Demo …" so they are never mistaken for real records, and demo mode never creates
 * people, cards or passwords. Create the first administrator with `npm run create-admin`.
 */
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedSchool } from "./seed-school";
import { PERMISSIONS, ROLE_PERMISSIONS, type RoleKey } from "../src/lib/permissions";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

const ROLE_NAMES: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super administrator",
  ADMIN: "Administrator",
  TEACHER: "Teacher",
  STUDENT: "Student",
  GUARDIAN: "Guardian",
};

const PERIODS: { name: string; start: string; end: string; kind: "CLASS" | "BREAK" | "LUNCH" }[] = [
  { name: "Period 1", start: "09:00", end: "09:50", kind: "CLASS" },
  { name: "Period 2", start: "09:50", end: "10:40", kind: "CLASS" },
  { name: "Break", start: "10:40", end: "11:00", kind: "BREAK" },
  { name: "Period 3", start: "11:00", end: "11:50", kind: "CLASS" },
  { name: "Period 4", start: "11:50", end: "12:40", kind: "CLASS" },
  { name: "Lunch", start: "12:40", end: "13:30", kind: "LUNCH" },
  { name: "Period 5", start: "13:30", end: "14:20", kind: "CLASS" },
  { name: "Period 6", start: "14:20", end: "15:10", kind: "CLASS" },
];

async function main() {
  const code = process.env.INSTITUTION_CODE ?? "CAMPUS";
  const name = process.env.INSTITUTION_NAME ?? "EduCore Institution";
  const timezone = process.env.INSTITUTION_TZ ?? "Asia/Kolkata";

  const inst = await prisma.institution.upsert({ where: { code }, create: { code, name, timezone }, update: {} });

  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  }
  const perms = await prisma.permission.findMany();
  const permId = new Map(perms.map((p) => [p.key, p.id]));

  for (const key of Object.keys(ROLE_PERMISSIONS) as RoleKey[]) {
    const role = await prisma.role.upsert({
      where: { institutionId_key: { institutionId: inst.id, key } },
      create: { institutionId: inst.id, key, name: ROLE_NAMES[key] },
      update: {},
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const ids = ROLE_PERMISSIONS[key].map((p) => permId.get(p)).filter((x): x is string => !!x);
    if (ids.length) await prisma.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: role.id, permissionId })) });
  }

  const settings: Record<string, unknown> = { workingDays: [1, 2, 3, 4, 5], requireEnrolledDevice: false };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.institutionSetting.upsert({
      where: { institutionId_key: { institutionId: inst.id, key } },
      create: { institutionId: inst.id, key, value: value as never },
      update: {},
    });
  }

  if ((await prisma.period.count({ where: { institutionId: inst.id } })) === 0) {
    await prisma.period.createMany({
      data: PERIODS.map((p, i) => ({ institutionId: inst.id, name: p.name, sequence: i + 1, startTime: p.start, endTime: p.end, kind: p.kind })),
    });
  }

  if (process.env.SEED_DEMO === "true") {
    await demo(inst.id);
    await seedSchool(prisma, inst.id);
  }

  console.log(`Seeded institution "${inst.name}" (${inst.code}).`);
  console.log("Next: npm run create-admin");
}

async function demo(institutionId: string) {
  const year = await prisma.academicYear.upsert({
    where: { institutionId_name: { institutionId, name: "Demo 2026–27" } },
    create: { institutionId, name: "Demo 2026–27", startDate: new Date("2026-06-01T00:00:00Z"), endDate: new Date("2027-04-30T00:00:00Z"), status: "ACTIVE" },
    update: {},
  });
  let dept = await prisma.department.findFirst({ where: { institutionId, code: "DEMO" } });
  dept ??= await prisma.department.create({ data: { institutionId, code: "DEMO", name: "Demo Department" } });
  let course = await prisma.course.findFirst({ where: { institutionId, code: "DEMO-C" } });
  course ??= await prisma.course.create({ data: { institutionId, departmentId: dept.id, code: "DEMO-C", name: "Demo Course" } });
  const cls = await prisma.class.upsert({
    where: { academicYearId_courseId_yearLevel_name: { academicYearId: year.id, courseId: course.id, yearLevel: 1, name: "Demo Class 1" } },
    create: { institutionId, courseId: course.id, academicYearId: year.id, name: "Demo Class 1", yearLevel: 1 },
    update: {},
  });
  if ((await prisma.division.count({ where: { classId: cls.id } })) === 0) {
    await prisma.division.create({ data: { institutionId, classId: cls.id, name: "A", capacity: 40 } });
  }
  for (const [code, subject] of [["DEMO-MATH", "Demo Mathematics"], ["DEMO-SCI", "Demo Science"]]) {
    if (!(await prisma.subject.findFirst({ where: { institutionId, code } }))) {
      await prisma.subject.create({ data: { institutionId, departmentId: dept.id, code, name: subject } });
    }
  }
  if (!(await prisma.classroom.findFirst({ where: { institutionId, code: "DEMO-101" } }))) {
    await prisma.classroom.create({ data: { institutionId, code: "DEMO-101", name: "Demo Room 101", capacity: 40, hasSmartBoard: true } });
  }
  console.log("Added DEMO academic structure (no people, cards or passwords).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
