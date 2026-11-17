import "server-only";
import { prisma } from "@/lib/db";
import type { CurrentSession } from "@/lib/auth/session";
import { getDaySchedule } from "@/features/schedule/today";
import type { Block } from "./blocks";

/**
 * Read-only tools the Copilot may call. Every tool is scoped by the caller's role and id on the server: the model
 * never chooses whose data to read, it can only ask for the caller's own view (or, for admins, school-wide lookups).
 * `data` is the short result the model sees; `blocks` are the visuals the browser shows (built here from real data).
 */
export interface ToolResult { data: unknown; blocks?: Block[] }
export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  roles: string[];
  run: (s: CurrentSession, args: Record<string, unknown>) => Promise<ToolResult>;
}

const none = { type: "object", properties: {}, additionalProperties: false };
const str = (v: unknown, max = 60) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const ADMINS = ["ADMIN", "SUPER_ADMIN"];

const PAGES: Record<string, { label: string; href: string; hint: string; k: string }[]> = {
  ADMIN: [
    { label: "Overview", href: "/admin", hint: "School dashboard", k: "home dashboard overview" },
    { label: "Students", href: "/admin/people/students", hint: "Add, import and manage students", k: "students people pupils" },
    { label: "Teachers", href: "/admin/people/teachers", hint: "Staff and assignments", k: "teachers staff" },
    { label: "Smart ID cards", href: "/admin/smart-id", hint: "Issue, replace, suspend, revoke", k: "smart id cards qr" },
    { label: "Timetable", href: "/admin/academic/timetable", hint: "Edit the weekly timetable", k: "timetable schedule periods" },
    { label: "Devices", href: "/admin/devices", hint: "Enroll kiosk devices", k: "devices kiosk laptop" },
    { label: "Audit and logins", href: "/admin/audit", hint: "Sign-in activity", k: "audit logins security logs" },
    { label: "Copilot", href: "/admin/copilot", hint: "Full-page chat", k: "copilot chat ai nova" },
  ],
  TEACHER: [
    { label: "Today", href: "/teacher", hint: "Today's classes", k: "today home dashboard classes" },
    { label: "Timetable", href: "/teacher/timetable", hint: "Your week", k: "timetable schedule week" },
    { label: "Library", href: "/teacher/library", hint: "Upload and publish study material", k: "library materials upload notes" },
    { label: "Copilot", href: "/teacher/copilot", hint: "Full-page chat", k: "copilot chat ai nova" },
  ],
  STUDENT: [
    { label: "Today", href: "/student", hint: "Your day", k: "today home dashboard" },
    { label: "Timetable", href: "/student/timetable", hint: "Your week", k: "timetable schedule week" },
    { label: "Library", href: "/student/library", hint: "Study material", k: "library materials notes" },
    { label: "Copilot", href: "/student/copilot", hint: "Full-page chat", k: "copilot chat ai nova" },
  ],
};
PAGES.SUPER_ADMIN = PAGES.ADMIN;

const isAdmin = (s: CurrentSession) => ADMINS.includes(s.role);

const TOOLS: ToolDef[] = [
  {
    name: "get_today_schedule",
    description: "Today's timetable for the signed-in student or teacher, with current and next period. Shows a timeline.",
    parameters: none,
    roles: ["STUDENT", "TEACHER"],
    async run(s) {
      const d = await getDaySchedule({ institutionId: s.institutionId, userId: s.userId, who: s.role === "TEACHER" ? "teacher" : "student" });
      const rows = d.rows.map((r) => ({
        time: `${r.startTime}-${r.endTime}`,
        title: r.subject ?? r.periodName,
        sub: [s.role === "TEACHER" ? r.division : r.teacher, r.classroom ? `Room ${r.classroom}` : null, r.note].filter(Boolean).join(" · ") || undefined,
        state: r.status as string,
      }));
      return {
        data: { date: d.dateLabel, now: d.current ? `${d.current.subject ?? d.current.periodName} until ${d.current.endTime}` : null, next: d.next ? `${d.next.subject ?? d.next.periodName} at ${d.next.startTime}` : null, periods: rows.length },
        blocks: rows.length ? [{ type: "timeline", date: d.dateLabel, rows }] : [],
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
        if (!enr) return { data: { class: null, subjects: [] }, blocks: [{ type: "summary", title: "My subjects", points: ["You are not enrolled in a class yet."] }] };
        const rows = await prisma.teacherAssignment.findMany({ where: { divisionId: enr.divisionId }, select: { subject: { select: { name: true } }, teacher: { select: { user: { select: { fullName: true } } } } } });
        const subjects = rows.map((r) => `${r.subject.name} (${r.teacher.user.fullName})`);
        return { data: { class: `${enr.division.class.name} ${enr.division.name}`, subjects }, blocks: [{ type: "summary", title: `My subjects · ${enr.division.class.name} ${enr.division.name}`, points: subjects.length ? subjects.slice(0, 6) : ["No subjects assigned yet."] }] };
      }
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      const rows = t ? await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { subject: { select: { name: true } }, division: { select: { name: true, class: { select: { name: true } } } } } }) : [];
      const teaches = [...new Set(rows.map((r) => `${r.subject.name}: ${r.division.class.name} ${r.division.name}`))];
      return { data: { teaches }, blocks: [{ type: "summary", title: "What I teach", points: teaches.length ? teaches.slice(0, 6) : ["No assignments yet."] }] };
    },
  },
  {
    name: "get_my_notifications",
    description: "The caller's most recent unread notifications.",
    parameters: none,
    roles: ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"],
    async run(s) {
      const rows = await prisma.notification.findMany({ where: { userId: s.userId, readAt: null }, orderBy: { createdAt: "desc" }, take: 5, select: { title: true, body: true } });
      const unread = rows.map((r) => (r.body ? `${r.title}: ${r.body.slice(0, 120)}` : r.title));
      return { data: { unread }, blocks: [{ type: "summary", title: "Unread notifications", points: unread.length ? unread : ["You are all caught up."] }] };
    },
  },
  {
    name: "list_my_students",
    description: "Students in one of the teacher's divisions, shown as cards. Optional class/division text such as '9 A'.",
    parameters: { type: "object", properties: { division: { type: "string", description: "e.g. 'Grade 9 A'" } }, additionalProperties: false },
    roles: ["TEACHER"],
    async run(s, args) {
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (!t) return { data: { students: [] } };
      const mine = await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { divisionId: true, division: { select: { name: true, class: { select: { name: true } } } } } });
      const q = str(args.division).toLowerCase().replace(/[^a-z0-9]/g, "");
      const ids = [...new Set(mine.filter((m) => !q || `${m.division.class.name}${m.division.name}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q)).map((m) => m.divisionId))];
      const enr = await prisma.enrollment.findMany({
        where: { status: "ACTIVE", divisionId: { in: ids } }, take: 12, orderBy: { rollNumber: "asc" },
        select: { student: { select: { studentCode: true, user: { select: { fullName: true, status: true } } } }, division: { select: { name: true, class: { select: { name: true } } } } },
      });
      const items = enr.map((e) => ({ name: e.student.user.fullName, code: e.student.studentCode, cls: `${e.division.class.name} ${e.division.name}`, status: e.student.user.status }));
      return { data: { shown: items.length, students: items.map((i) => `${i.name} (${i.cls})`) }, blocks: items.length ? [{ type: "students", items }] : [] };
    },
  },
  {
    name: "school_stats",
    description: "School-wide headline counts (active students, teachers, classes, divisions, active Smart ID cards) with a card-status chart.",
    parameters: none,
    roles: ADMINS,
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
      return {
        data: { students, teachers, classes, divisions, cards: { active, suspended, revoked } },
        blocks: [
          { type: "stats", items: [{ label: "Students", value: students }, { label: "Teachers", value: teachers }, { label: "Classes", value: classes }, { label: "Active cards", value: active }] },
          ...(active + suspended + revoked ? [{ type: "donut" as const, title: "Smart ID cards by status", slices: [{ label: "Active", value: active }, { label: "Suspended", value: suspended }, { label: "Revoked", value: revoked }].filter((x) => x.value > 0) }] : []),
        ],
      };
    },
  },
  {
    name: "students_by_division",
    description: "Number of active students in each class and division, shown as a bar chart (admin only).",
    parameters: none,
    roles: ADMINS,
    async run(s) {
      const rows = await prisma.enrollment.groupBy({ by: ["divisionId"], where: { status: "ACTIVE", student: { institutionId: s.institutionId } }, _count: { _all: true } });
      const divs = await prisma.division.findMany({ where: { id: { in: rows.map((r) => r.divisionId) } }, select: { id: true, name: true, class: { select: { name: true, yearLevel: true } } } });
      const by = new Map(divs.map((d) => [d.id, d]));
      const out = rows
        .map((r) => ({ d: by.get(r.divisionId), value: r._count._all }))
        .filter((x): x is { d: NonNullable<typeof x.d>; value: number } => !!x.d)
        .sort((a, b) => a.d.class.yearLevel - b.d.class.yearLevel || a.d.name.localeCompare(b.d.name))
        .map((x) => ({ label: `${x.d.class.name} ${x.d.name}`, value: x.value }));
      return { data: { divisions: out.map((o) => `${o.label}: ${o.value}`) }, blocks: out.length ? [{ type: "bar", title: "Students per division", rows: out }] : [] };
    },
  },
  {
    name: "find_people",
    description: "Find up to 5 students or teachers by name (admin only). Shown as cards; returns name, code and class only.",
    parameters: { type: "object", properties: { kind: { type: "string", enum: ["student", "teacher"] }, name: { type: "string" } }, required: ["kind", "name"], additionalProperties: false },
    roles: ADMINS,
    async run(s, args) {
      const name = str(args.name);
      if (name.length < 2) return { data: { error: "Give at least 2 letters of the name." } };
      if (args.kind === "teacher") {
        const rows = await prisma.teacherProfile.findMany({
          where: { institutionId: s.institutionId, user: { fullName: { contains: name } } }, take: 5,
          select: { teacherCode: true, designation: true, user: { select: { fullName: true, status: true } }, assignments: { select: { subject: { select: { name: true } }, divisionId: true } } },
        });
        const items = rows.map((r) => ({ name: r.user.fullName, code: r.teacherCode, role: r.designation ?? undefined, status: r.user.status, subjects: [...new Set(r.assignments.map((a) => a.subject.name))], classes: new Set(r.assignments.map((a) => a.divisionId)).size }));
        return { data: { teachers: items.map((i) => `${i.name} (${i.code}, ${i.subjects.join("/") || "no subjects"})`) }, blocks: items.length ? [{ type: "teachers", items }] : [] };
      }
      const rows = await prisma.studentProfile.findMany({
        where: { institutionId: s.institutionId, user: { fullName: { contains: name } } }, take: 5,
        select: { userId: true, studentCode: true, user: { select: { fullName: true, status: true } }, enrollments: { where: { status: "ACTIVE" }, take: 1, select: { division: { select: { name: true, class: { select: { name: true } } } } } } },
      });
      const items = rows.map((r) => ({ name: r.user.fullName, code: r.studentCode, cls: r.enrollments[0] ? `${r.enrollments[0].division.class.name} ${r.enrollments[0].division.name}` : "Not enrolled", status: r.user.status, href: `/admin/people/students/${r.userId}` }));
      return { data: { students: items.map((i) => `${i.name} (${i.code}, ${i.cls})`) }, blocks: items.length ? [{ type: "students", items }] : [] };
    },
  },
  {
    name: "list_materials",
    description: "Study material (PDFs, documents, slides) with links to open them. Students see published material for their subjects; teachers see material for the subjects they teach, including drafts; admins see the latest. Optional subject text.",
    parameters: { type: "object", properties: { subject: { type: "string" } }, additionalProperties: false },
    roles: ["STUDENT", "TEACHER", ...ADMINS],
    async run(s, args) {
      const subj = str(args.subject);
      let subjectIds: string[] | undefined;
      let published = false;
      if (s.role === "STUDENT") {
        const enr = await prisma.enrollment.findFirst({ where: { status: "ACTIVE", student: { userId: s.userId } }, select: { divisionId: true } });
        const rows = enr ? await prisma.teacherAssignment.findMany({ where: { divisionId: enr.divisionId }, select: { subjectId: true } }) : [];
        subjectIds = rows.map((r) => r.subjectId);
        published = true;
      } else if (s.role === "TEACHER") {
        const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
        const rows = t ? await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { subjectId: true } }) : [];
        subjectIds = rows.map((r) => r.subjectId);
      }
      const rows = await prisma.learningMaterial.findMany({
        where: { institutionId: s.institutionId, ...(published ? { status: "PUBLISHED" } : { status: { not: "ARCHIVED" } }), ...(subjectIds ? { subjectId: { in: subjectIds } } : {}), ...(subj ? { subject: { name: { contains: subj } } } : {}) },
        orderBy: { createdAt: "desc" }, take: 8,
        select: { title: true, type: true, status: true, subject: { select: { name: true } }, file: { select: { id: true, sizeBytes: true } } },
      });
      const kb = (n: bigint | number) => (Number(n) > 1048576 ? `${(Number(n) / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(Number(n) / 1024))} KB`);
      const items = rows.map((m) => ({ title: m.title, subject: m.subject.name, kind: String(m.type), size: m.file ? kb(m.file.sizeBytes) : "link", status: m.status, href: m.file ? `/api/files/${m.file.id}` : undefined }));
      return { data: { count: items.length, items: items.map((i) => `${i.title} (${i.subject}, ${i.status})`) }, blocks: items.length ? [{ type: "materials", items }] : [] };
    },
  },
  {
    name: "my_week_load",
    description: "Number of periods the teacher teaches on each weekday, as a bar chart.",
    parameters: none,
    roles: ["TEACHER"],
    async run(s) {
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      const rows = t ? await prisma.timetableEntry.groupBy({ by: ["dayOfWeek"], where: { teacherId: t.id, status: "ACTIVE" }, _count: { _all: true } }) : [];
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const out = rows.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((r) => ({ label: names[r.dayOfWeek % 7], value: r._count._all }));
      return { data: { perDay: out.map((o) => `${o.label}: ${o.value}`) }, blocks: out.length ? [{ type: "bar", title: "My periods per weekday", rows: out }] : [] };
    },
  },
  {
    name: "teacher_workload",
    description: "Periods per week for each teacher, as a bar chart (admin only).",
    parameters: none,
    roles: ADMINS,
    async run(s) {
      const rows = await prisma.timetableEntry.groupBy({ by: ["teacherId"], where: { institutionId: s.institutionId, status: "ACTIVE" }, _count: { _all: true } });
      const ts = await prisma.teacherProfile.findMany({ where: { id: { in: rows.map((r) => r.teacherId) } }, select: { id: true, user: { select: { fullName: true } } } });
      const by = new Map(ts.map((x) => [x.id, x.user.fullName]));
      const out = rows.map((r) => ({ label: by.get(r.teacherId) ?? "Unknown", value: r._count._all })).sort((a, b) => b.value - a.value).slice(0, 10);
      return { data: { workload: out.map((o) => `${o.label}: ${o.value}`) }, blocks: out.length ? [{ type: "bar", title: "Periods per week by teacher", rows: out }] : [] };
    },
  },
  {
    name: "sign_in_activity",
    description: "Sign-in results over the last 24 hours (successful, failed, locked, other) as a donut (admin only).",
    parameters: none,
    roles: ADMINS,
    async run(s) {
      const since = new Date(Date.now() - 24 * 3600_000);
      const rows = await prisma.authenticationLog.groupBy({ by: ["result"], where: { institutionId: s.institutionId, createdAt: { gte: since } }, _count: { _all: true } });
      const n = (k: string[]) => rows.filter((r) => k.includes(r.result)).reduce((a, r) => a + r._count._all, 0);
      const ok = n(["SUCCESS"]);
      const bad = n(["INVALID_CREDENTIAL", "WRONG_PORTAL", "DEVICE_UNAUTHORIZED"]);
      const lock = n(["LOCKED", "RATE_LIMITED"]);
      const other = rows.reduce((a, r) => a + r._count._all, 0) - ok - bad - lock;
      const slices = [{ label: "Successful", value: ok }, { label: "Failed", value: bad }, { label: "Locked or rate-limited", value: lock }, { label: "Other", value: other }].filter((x) => x.value > 0);
      return { data: { last24h: { ok, failed: bad, locked: lock, other } }, blocks: slices.length ? [{ type: "donut", title: "Sign-ins, last 24 hours", slices }] : [] };
    },
  },
  {
    name: "open_page",
    description: "Show shortcut links to pages the user can open (for example 'open smart id cards', 'go to the library'). Pass an optional query; with no query it lists every page for the role.",
    parameters: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false },
    roles: ["STUDENT", "TEACHER", ...ADMINS],
    async run(s, args) {
      const all = PAGES[s.role] ?? [];
      const q = str(args.query, 40).toLowerCase().trim();
      const words = q.split(/\s+/).filter((w) => w.length > 1);
      const hit = words.length ? all.filter((p) => words.some((w) => (p.label + " " + p.k).toLowerCase().includes(w))) : all;
      const items = (hit.length ? hit : all).slice(0, 6).map((p) => ({ label: p.label, href: p.href, hint: p.hint }));
      return { data: { pages: items.map((i) => i.label) }, blocks: [{ type: "links", items }] };
    },
  },
  {
    name: "card_status",
    description: "Smart ID cards by status (active, suspended, revoked, replaced) with the number of people who still have no active card.",
    parameters: none,
    roles: ADMINS,
    async run(s) {
      const i = s.institutionId;
      const [groups, people, withActive] = await Promise.all([
        prisma.smartIdCredential.groupBy({ by: ["status"], where: { institutionId: i }, _count: { _all: true } }),
        prisma.user.count({ where: { institutionId: i, status: "ACTIVE", OR: [{ student: { isNot: null } }, { teacher: { isNot: null } }] } }),
        prisma.smartIdCredential.findMany({ where: { institutionId: i, status: "ACTIVE" }, distinct: ["userId"], select: { userId: true } }),
      ]);
      const slices = groups.map((g) => ({ label: g.status[0] + g.status.slice(1).toLowerCase(), value: g._count._all })).filter((x) => x.value > 0);
      const missing = Math.max(0, people - withActive.length);
      return { data: { byStatus: slices, peopleWithoutActiveCard: missing }, blocks: [...(slices.length ? [{ type: "donut" as const, title: "Smart ID cards by status", slices }] : []), { type: "stats" as const, items: [{ label: "With active card", value: withActive.length }, { label: "Without a card", value: missing }] }] };
    },
  },
  {
    name: "my_attendance",
    description: "The student's own attendance for the last 30 days, as a chart.",
    parameters: none,
    roles: ["STUDENT"],
    async run(s) {
      const sp = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (!sp) return { data: { error: "No student profile." } };
      const since = new Date(Date.now() - 30 * 86_400_000);
      const g = await prisma.attendance.groupBy({ by: ["status"], where: { studentId: sp.id, date: { gte: since } }, _count: { _all: true } });
      const slices = g.map((x) => ({ label: x.status.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), value: x._count._all }));
      return { data: { last30Days: slices }, blocks: slices.length ? [{ type: "donut", title: "My attendance, last 30 days", slices }] : [{ type: "summary", title: "My attendance", points: ["No attendance has been recorded in the last 30 days."] }] };
    },
  },
  {
    name: "mark_notifications_read",
    description: "Mark ALL of the caller's own unread notifications as read. Only call when the user explicitly asks to mark or clear them.",
    parameters: none,
    roles: ["STUDENT", "TEACHER", ...ADMINS],
    async run(s) {
      const r = await prisma.notification.updateMany({ where: { userId: s.userId, readAt: null }, data: { readAt: new Date() } });
      return { data: { markedRead: r.count }, blocks: [{ type: "summary", title: "Notifications", points: [r.count ? `Marked ${r.count} notification${r.count === 1 ? "" : "s"} as read.` : "You had no unread notifications."] }] };
    },
  },
  {
    name: "show_summary",
    description: "Show a summary card. Use it whenever the user asks for a summary, recap, plan overview or key points. Pass a short title and 3 to 6 short bullet points.",
    parameters: { type: "object", properties: { title: { type: "string" }, points: { type: "array", items: { type: "string" } }, next: { type: "string", description: "Optional suggested next step" } }, required: ["title", "points"], additionalProperties: false },
    roles: ["STUDENT", "TEACHER", ...ADMINS],
    async run(_s, args) {
      const points = Array.isArray(args.points) ? args.points.map((p) => str(p, 160)).filter(Boolean).slice(0, 6) : [];
      if (!points.length) return { data: { error: "Provide bullet points." } };
      return { data: { shown: true }, blocks: [{ type: "summary", title: str(args.title, 80) || "Summary", points, next: str(args.next, 160) || undefined }] };
    },
  },
];

export const toolsFor = (role: string) => TOOLS.filter((t) => t.roles.includes(role));

export const toolSpecs = (role: string) =>
  toolsFor(role).map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));

/** Runs one tool call. Returns the compact text for the model plus the visuals for the browser. */
export async function runTool(s: CurrentSession, name: string, rawArgs: string): Promise<{ content: string; blocks: Block[] }> {
  const tool = toolsFor(s.role).find((t) => t.name === name);
  if (!tool) return { content: JSON.stringify({ error: "Unknown tool." }), blocks: [] };
  let args: Record<string, unknown> = {};
  try { args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {}; } catch { /* use empty args */ }
  try {
    const r = await tool.run(s, args);
    return { content: JSON.stringify(r.data).slice(0, 2500), blocks: r.blocks ?? [] };
  } catch (e) {
    console.error("AI tool failed", name, e);
    return { content: JSON.stringify({ error: "That lookup failed." }), blocks: [] };
  }
}
