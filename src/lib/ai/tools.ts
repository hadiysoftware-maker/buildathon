import "server-only";
import { prisma } from "@/lib/db";
import type { CurrentSession } from "@/lib/auth/session";
import { getDaySchedule } from "@/features/schedule/today";

/**
 * Read-only tools the Copilot may call. Every tool is scoped by the caller's role and id on the server: the model
 * never chooses whose data to read, it can only ask for the caller's own view (or, for admins, school-wide lookups).
 * Results are kept short to save tokens, and personal contact details are never returned.
 */
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  roles: string[];
  run: (s: CurrentSession, args: Record<string, unknown>) => Promise<unknown>;
}

const none = { type: "object", properties: {}, additionalProperties: false };
const str = (v: unknown, max = 60) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const TOOLS: ToolDef[] = [
  {
    name: "get_today_schedule",
    description: "Today's timetable for the signed-in student or teacher, with current and next period.",
    parameters: none,
    roles: ["STUDENT", "TEACHER"],
    async run(s) {
      const d = await getDaySchedule({ institutionId: s.institutionId, userId: s.userId, who: s.role === "TEACHER" ? "teacher" : "student" });
      return {
        date: d.dateLabel,
        now: d.current ? `${d.current.subject ?? d.current.periodName} until ${d.current.endTime}` : null,
        next: d.next ? `${d.next.subject ?? d.next.periodName} at ${d.next.startTime}` : null,
        periods: d.rows.map((r) => `${r.startTime}-${r.endTime} ${r.subject ?? r.periodName}${r.division && s.role === "TEACHER" ? ` (${r.division})` : ""}${r.classroom ? ` @${r.classroom}` : ""} [${r.status}]${r.note ? ` ${r.note}` : ""}`),
      };
    },
  },
  {
    name: "get_my_subjects",
    description: "Subjects and teachers for the student's class, or the classes and subjects the teacher teaches.",
    parameters: none,
    roles: ["STUDENT", "TEACHER"],
    async run(s) {
      if (s.role === "STUDENT") {
        const enr = await prisma.enrollment.findFirst({ where: { status: "ACTIVE", student: { userId: s.userId } }, include: { division: { include: { class: { select: { name: true } } } } } });
        if (!enr) return { class: null, subjects: [] };
        const rows = await prisma.teacherAssignment.findMany({ where: { divisionId: enr.divisionId }, select: { subject: { select: { name: true } }, teacher: { select: { user: { select: { fullName: true } } } } } });
        return { class: `${enr.division.class.name} ${enr.division.name}`, subjects: rows.map((r) => `${r.subject.name} (${r.teacher.user.fullName})`) };
      }
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      const rows = t ? await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { subject: { select: { name: true } }, division: { select: { name: true, class: { select: { name: true } } } } } }) : [];
      return { teaches: rows.map((r) => `${r.subject.name}: ${r.division.class.name} ${r.division.name}`) };
    },
  },
  {
    name: "get_my_notifications",
    description: "The caller's most recent unread notifications.",
    parameters: none,
    roles: ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"],
    async run(s) {
      const rows = await prisma.notification.findMany({ where: { userId: s.userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 5, select: { title: true, body: true } });
      return { unread: rows.map((r) => (r.body ? `${r.title}: ${r.body.slice(0, 120)}` : r.title)) };
    },
  },
  {
    name: "list_my_students",
    description: "Names of students in one of the teacher's divisions. Optional class/division text such as '9 A'.",
    parameters: { type: "object", properties: { division: { type: "string", description: "e.g. 'Grade 9 A'" } }, additionalProperties: false },
    roles: ["TEACHER"],
    async run(s, args) {
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (!t) return { students: [] };
      const mine = await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { divisionId: true, division: { select: { name: true, class: { select: { name: true } } } } } });
      const q = str(args.division).toLowerCase().replace(/[^a-z0-9]/g, "");
      const ids = [...new Set(mine.filter((m) => !q || `${m.division.class.name}${m.division.name}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q)).map((m) => m.divisionId))];
      const enr = await prisma.enrollment.findMany({ where: { status: "ACTIVE", divisionId: { in: ids } }, take: 45, orderBy: { rollNumber: "asc" }, select: { rollNumber: true, student: { select: { user: { select: { fullName: true } } } }, division: { select: { name: true, class: { select: { name: true } } } } } });
      return { students: enr.map((e) => `${e.division.class.name} ${e.division.name} #${e.rollNumber ?? "-"} ${e.student.user.fullName}`) };
    },
  },
  {
    name: "school_stats",
    description: "School-wide counts: active students, teachers, classes, divisions, active Smart ID cards, and cards suspended or revoked.",
    parameters: none,
    roles: ["ADMIN", "SUPER_ADMIN"],
    async run(s) {
      const i = s.institutionId;
      const [students, teachers, classes, divisions, active, suspended, revoked] = await Promise.all([
        prisma.studentProfile.count({ where: { institutionId: i, user: { status: "ACTIVE" } } }),
        prisma.teacherProfile.count({ where: { institutionId: i, user: { status: "ACTIVE" } } }),
        prisma.class.count({ where: { institutionId: i, archivedAt: null } }),
        prisma.division.count({ where: { institutionId: i, archivedAt: null } }),
        prisma.smartIdCredential.count({ where: { institutionId: i, status: "ACTIVE" } }),
        prisma.smartIdCredential.count({ where: { institutionId: i, status: "SUSPENDED" } }),
        prisma.smartIdCredential.count({ where: { institutionId: i, status: "REVOKED" } }),
      ]);
      return { students, teachers, classes, divisions, cards: { active, suspended, revoked } };
    },
  },
  {
    name: "find_people",
    description: "Find up to 5 students or teachers by name (admin only). Returns name, code and class only.",
    parameters: { type: "object", properties: { kind: { type: "string", enum: ["student", "teacher"] }, name: { type: "string" } }, required: ["kind", "name"], additionalProperties: false },
    roles: ["ADMIN", "SUPER_ADMIN"],
    async run(s, args) {
      const name = str(args.name);
      if (name.length < 2) return { error: "Give at least 2 letters of the name." };
      if (args.kind === "teacher") {
        const rows = await prisma.teacherProfile.findMany({ where: { institutionId: s.institutionId, user: { fullName: { contains: name } } }, take: 5, select: { teacherCode: true, designation: true, user: { select: { fullName: true, status: true } } } });
        return { teachers: rows.map((r) => `${r.user.fullName} (${r.teacherCode}${r.designation ? `, ${r.designation}` : ""}, ${r.user.status})`) };
      }
      const rows = await prisma.studentProfile.findMany({
        where: { institutionId: s.institutionId, user: { fullName: { contains: name } } }, take: 5,
        select: { studentCode: true, user: { select: { fullName: true, status: true } }, enrollments: { where: { status: "ACTIVE" }, take: 1, select: { division: { select: { name: true, class: { select: { name: true } } } } } } },
      });
      return { students: rows.map((r) => `${r.user.fullName} (${r.studentCode}, ${r.enrollments[0] ? `${r.enrollments[0].division.class.name} ${r.enrollments[0].division.name}` : "not enrolled"}, ${r.user.status})`) };
    },
  },
];

export const toolsFor = (role: string) => TOOLS.filter((t) => t.roles.includes(role));

export const toolSpecs = (role: string) =>
  toolsFor(role).map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));

export async function runTool(s: CurrentSession, name: string, rawArgs: string): Promise<string> {
  const tool = toolsFor(s.role).find((t) => t.name === name);
  if (!tool) return JSON.stringify({ error: "Unknown tool." });
  let args: Record<string, unknown> = {};
  try { args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {}; } catch { /* use empty args */ }
  try {
    return JSON.stringify(await tool.run(s, args)).slice(0, 3000);
  } catch (e) {
    console.error("AI tool failed", name, e);
    return JSON.stringify({ error: "That lookup failed." });
  }
}
