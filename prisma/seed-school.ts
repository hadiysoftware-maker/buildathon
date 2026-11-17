/**
 * Demo school: teachers, classes, divisions, subjects, rooms, students, a conflict-free timetable and
 * Smart ID cards. Everything is labelled as demo data in the output; names are made up.
 *
 * The QR payloads (secrets) are written to .seed/cards.csv and .seed/cards/*.png (git-ignored). They are the
 * ONLY copy: the database keeps just an HMAC. Delete the folder when you are done testing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "../src/generated/prisma/client";

const GRADES = [8, 9, 10];
const DIVS = ["A", "B"];
const SUBJECTS = [
  { code: "MATH", name: "Mathematics" },
  { code: "SCI", name: "Science" },
  { code: "ENG", name: "English" },
  { code: "SST", name: "Social Studies" },
  { code: "CS", name: "Computer Science" },
  { code: "PE", name: "Physical Education" },
];
// teacher index per subject, with a second teacher taking Grade 10 for Math and Science
const TEACHERS = [
  ["Meera Nair", "Mathematics"], ["Rohan Iyer", "Science"], ["Sana Qureshi", "English"], ["Vikram Rao", "Social Studies"],
  ["Anita Desai", "Computer Science"], ["Karan Malhotra", "Physical Education"], ["Priya Menon", "Mathematics"], ["Arjun Bhat", "Science"],
] as const;
const FIRST = ["Aarav", "Diya", "Ishaan", "Anaya", "Vihaan", "Myra", "Reyansh", "Saanvi", "Kabir", "Aditi", "Arnav", "Kiara", "Dhruv", "Navya", "Rudra", "Tara", "Yash", "Zoya", "Neil", "Riya", "Om", "Pari", "Sahil", "Veda"];
const LAST = ["Sharma", "Patel", "Reddy", "Khan", "Singh", "Joshi", "Kulkarni", "Das", "Gupta", "Mehta", "Pillai", "Chopra"];

export async function seedSchool(prisma: PrismaClient, institutionId: string) {
  const pepper = process.env.SMART_ID_PEPPER;
  if (!pepper) throw new Error("SMART_ID_PEPPER is required to issue the seeded cards");

  // Replace the minimal placeholder structure with the fuller one.
  await prisma.timetableEntry.deleteMany({ where: { institutionId } });
  await prisma.teacherAssignment.deleteMany({ where: { division: { institutionId } } });
  const demoYears = await prisma.academicYear.findMany({ where: { institutionId, name: { startsWith: "Demo" } }, select: { id: true } });
  if (demoYears.length) {
    const ids = demoYears.map((y) => y.id);
    await prisma.division.deleteMany({ where: { class: { academicYearId: { in: ids } } } });
    await prisma.class.deleteMany({ where: { academicYearId: { in: ids } } });
    await prisma.academicYear.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.subject.deleteMany({ where: { institutionId, code: { startsWith: "DEMO" } } });
  await prisma.classroom.deleteMany({ where: { institutionId, code: { startsWith: "DEMO" } } });
  await prisma.course.deleteMany({ where: { institutionId, code: { startsWith: "DEMO" } } });
  await prisma.department.deleteMany({ where: { institutionId, code: { startsWith: "DEMO" } } });

  const year = await prisma.academicYear.upsert({
    where: { institutionId_name: { institutionId, name: "2026–27" } },
    create: { institutionId, name: "2026–27", startDate: new Date("2026-06-01T00:00:00Z"), endDate: new Date("2027-04-30T00:00:00Z"), status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });
  await prisma.academicYear.updateMany({ where: { institutionId, id: { not: year.id }, status: "ACTIVE" }, data: { status: "ARCHIVED" } });

  const dept = (await prisma.department.findFirst({ where: { institutionId, code: "SEC" } })) ?? (await prisma.department.create({ data: { institutionId, code: "SEC", name: "Secondary School" } }));
  const course = (await prisma.course.findFirst({ where: { institutionId, code: "SEC-GEN" } })) ?? (await prisma.course.create({ data: { institutionId, departmentId: dept.id, code: "SEC-GEN", name: "Secondary Education (Grades 8–10)", durationYears: 3 } }));

  const subj = new Map<string, string>();
  for (const s of SUBJECTS) {
    const row = (await prisma.subject.findFirst({ where: { institutionId, code: s.code } })) ?? (await prisma.subject.create({ data: { institutionId, departmentId: dept.id, code: s.code, name: s.name, periodsPerWeek: 5 } }));
    subj.set(s.code, row.id);
    await prisma.courseSubject.upsert({ where: { courseId_subjectId: { courseId: course.id, subjectId: row.id } }, create: { courseId: course.id, subjectId: row.id }, update: {} });
  }

  const roleOf = async (key: "TEACHER" | "STUDENT") => (await prisma.role.findUniqueOrThrow({ where: { institutionId_key: { institutionId, key } } })).id;
  const [teacherRole, studentRole] = [await roleOf("TEACHER"), await roleOf("STUDENT")];

  // Teachers
  const teachers: { id: string; userId: string; name: string }[] = [];
  for (const [i, [name, spec]] of TEACHERS.entries()) {
    const email = `${name.toLowerCase().replace(/ /g, ".")}@demo.campus2035.test`;
    let u = await prisma.user.findFirst({ where: { institutionId, email }, include: { teacher: true } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          institutionId, fullName: name, email, roles: { create: { roleId: teacherRole } },
          teacher: { create: { institutionId, teacherCode: `T${200001 + i}`, employeeId: `EMP-${1001 + i}`, departmentId: dept.id, designation: "Subject teacher", specialization: spec, qualification: "B.Ed" } },
        },
        include: { teacher: true },
      });
    }
    teachers.push({ id: u.teacher!.id, userId: u.id, name });
  }
  const T = (i: number) => teachers[i];

  // Rooms
  const rooms: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const code = `R10${i}`;
    const r = (await prisma.classroom.findFirst({ where: { institutionId, code } })) ?? (await prisma.classroom.create({ data: { institutionId, code, name: `Room ${100 + i}`, building: "Main block", capacity: 40, hasSmartBoard: true } }));
    rooms.push(r.id);
  }

  // Classes, divisions
  const divisions: { id: string; grade: number; name: string; k: number }[] = [];
  let k = 0;
  for (const [gi, g] of GRADES.entries()) {
    const cls = await prisma.class.upsert({
      where: { academicYearId_courseId_yearLevel_name: { academicYearId: year.id, courseId: course.id, yearLevel: gi + 1, name: `Grade ${g}` } },
      create: { institutionId, courseId: course.id, academicYearId: year.id, name: `Grade ${g}`, yearLevel: gi + 1 },
      update: {},
    });
    for (const d of DIVS) {
      const div = (await prisma.division.findFirst({ where: { classId: cls.id, name: d } })) ?? (await prisma.division.create({ data: { institutionId, classId: cls.id, name: d, capacity: 40 } }));
      await prisma.division.update({ where: { id: div.id }, data: { classTeacherId: T(k).id, classroomId: rooms[k] } });
      divisions.push({ id: div.id, grade: g, name: d, k });
      k++;
    }
  }

  // Teaching assignments: subject index → teacher (second Math/Science teacher for Grade 10)
  const teacherFor = (code: string, grade: number) =>
    code === "MATH" ? (grade === 10 ? T(6) : T(0)) : code === "SCI" ? (grade === 10 ? T(7) : T(1)) : T({ ENG: 2, SST: 3, CS: 4, PE: 5 }[code]!);
  for (const dv of divisions) {
    for (const s of SUBJECTS) {
      await prisma.teacherAssignment.create({ data: { academicYearId: year.id, divisionId: dv.id, subjectId: subj.get(s.code)!, teacherId: teacherFor(s.code, dv.grade).id, periodsPerWeek: 5 } });
    }
  }

  // Timetable: subject = (period + division + day) mod 6 is a Latin square, so at any slot the six divisions
  // study six different subjects and no teacher or room is ever double-booked.
  const classPeriods = await prisma.period.findMany({ where: { institutionId, kind: "CLASS", archivedAt: null }, orderBy: { sequence: "asc" }, take: 6 });
  const entries = [];
  for (const dv of divisions) {
    for (let day = 1; day <= 5; day++) {
      for (const [p, per] of classPeriods.entries()) {
        const s = SUBJECTS[(p + dv.k + day) % 6];
        entries.push({
          institutionId, academicYearId: year.id, divisionId: dv.id, dayOfWeek: day, periodId: per.id,
          subjectId: subj.get(s.code)!, teacherId: teacherFor(s.code, dv.grade).id, classroomId: rooms[dv.k],
        });
      }
    }
  }
  await prisma.timetableEntry.createMany({ data: entries });

  // Students: 8 per division
  type Person = { userId: string; code: string; name: string; role: string };
  const people: Person[] = teachers.map((t, i) => ({ userId: t.userId, code: `T${200001 + i}`, name: t.name, role: "Teacher" }));
  let n = 0;
  for (const dv of divisions) {
    for (let r = 1; r <= 8; r++) {
      const name = `${FIRST[(n * 7 + 3) % FIRST.length]} ${LAST[(n * 5 + 1) % LAST.length]}`;
      const code = `S${100001 + n}`;
      const exists = await prisma.studentProfile.findFirst({ where: { institutionId, studentCode: code } });
      let userId = exists?.userId;
      if (!exists) {
        const u = await prisma.user.create({
          data: {
            institutionId, fullName: name, roles: { create: { roleId: studentRole } },
            student: { create: { institutionId, studentCode: code, admissionNumber: `ADM-26-${String(n + 1).padStart(3, "0")}`, departmentId: dept.id, courseId: course.id, admissionDate: new Date("2026-06-01T00:00:00Z"), guardianName: `${LAST[(n * 5 + 1) % LAST.length]} (guardian)`, guardianRelation: "Parent", dateOfBirth: new Date(Date.UTC(2026 - dv.grade - 5, n % 12, 1 + (n % 27))) } },
          },
          include: { student: true },
        });
        await prisma.studentPortfolio.create({ data: { studentId: u.student!.id } });
        await prisma.enrollment.create({ data: { studentId: u.student!.id, divisionId: dv.id, academicYearId: year.id, rollNumber: r } });
        userId = u.id;
      }
      people.push({ userId: userId!, code, name, role: `Student · Grade ${dv.grade}${dv.name}` });
      n++;
    }
  }

  // Cards (secrets exist only in the output files)
  mkdirSync(".seed/cards", { recursive: true });
  const rows = ["code,name,role,payload"];
  let issued = 0;
  for (const p of people) {
    const active = await prisma.smartIdCredential.count({ where: { userId: p.userId, status: "ACTIVE" } });
    if (active) continue;
    const secret = randomBytes(32).toString("base64url");
    const cred = await prisma.smartIdCredential.create({ data: { institutionId, userId: p.userId, secretHash: createHmac("sha256", pepper).update(secret).digest("hex") } });
    const payload = `C35:${cred.id}.${secret}`;
    rows.push(`${p.code},"${p.name}","${p.role}",${payload}`);
    await QRCode.toFile(`.seed/cards/${p.code}.png`, payload, { width: 360, margin: 2 });
    issued++;
  }
  if (issued) writeFileSync(".seed/cards.csv", rows.join("\n") + "\n");

  // Secondary sign-in: username + password (random per person; the plain text exists only in .seed/logins.csv)
  const logins = ["code,name,role,username,password"];
  let given = 0;
  for (const p of people) {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: p.userId }, select: { username: true, passwordHash: true } });
    if (u.username && u.passwordHash) continue;
    const base = p.name.toLowerCase().replace(/[^a-zs]/g, "").trim().replace(/s+/g, ".");
    let username = base;
    for (let i = 2; await prisma.user.findFirst({ where: { institutionId, username } }); i++) username = base + i;
    const password = randomBytes(9).toString("base64url");
    await prisma.user.update({ where: { id: p.userId }, data: { username, passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }) } });
    logins.push(`${p.code},"${p.name}","${p.role}",${username},${password}`);
    given++;
  }
  if (given) writeFileSync(".seed/logins.csv", logins.join("
") + "
");

  console.log(`School demo: ${teachers.length} teachers, ${divisions.length} divisions, ${n} students, ${entries.length} timetable slots.`);
  console.log(given ? `Created ${given} username/password logins → .seed/logins.csv (only copy of the passwords).` : "All demo people already have logins.");
  console.log(issued ? `Issued ${issued} Smart ID cards → .seed/cards.csv and .seed/cards/*.png (only copy of the QR secrets).` : "All demo people already have active cards (existing QR files are not regenerated).");
}
