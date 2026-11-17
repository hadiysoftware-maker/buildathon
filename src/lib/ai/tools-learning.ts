import "server-only";
import { prisma } from "@/lib/db";
import { practiceSummary } from "./practice-data";
import { atRiskStudents } from "@/features/risk/risk";
import { recentLessons, subjectsWithTeachers, todayUtc } from "./lessons";
import type { ToolDef } from "./tools";

const none = { type: "object", properties: {}, additionalProperties: false };
const str = (v: unknown, max = 60) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const when = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

async function studentCtx(userId: string) {
  const st = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!st) return null;
  const enr = await prisma.enrollment.findFirst({ where: { studentId: st.id, status: "ACTIVE" }, select: { divisionId: true } });
  return { studentId: st.id, divisionId: enr?.divisionId ?? null };
}

export const LEARNING_TOOLS: ToolDef[] = [
  {
    name: "my_assignments",
    description: "The student's own assignments: what is due, overdue, submitted and graded (marks only once released). Use for homework, deadlines, 'what do I need to do'.",
    parameters: none,
    roles: ["STUDENT"],
    async run(s) {
      const c = await studentCtx(s.userId);
      if (!c?.divisionId) return { data: { error: "Not enrolled in a class." } };
      const list = await prisma.assignment.findMany({
        where: { institutionId: s.institutionId, divisionId: c.divisionId, status: { in: ["PUBLISHED", "CLOSED"] } },
        orderBy: { dueAt: "asc" }, take: 30,
        include: { subject: { select: { name: true } }, submissions: { where: { studentId: c.studentId }, orderBy: { attempt: "desc" }, take: 1, include: { grade: true } } },
      });
      const now = new Date();
      const rows = list.map((a) => {
        const sub = a.submissions[0];
        const marks = sub?.grade?.status === "RELEASED" ? Number(sub.grade.marks) : null;
        const state = sub?.status === "RESUBMIT_REQUESTED" ? "redo requested" : marks !== null ? "graded" : sub ? "submitted" : a.dueAt < now ? "overdue" : "to do";
        return { id: a.id, title: a.title, subject: a.subject.name, due: when(a.dueAt), state, marks, outOf: Number(a.maxMarks) };
      });
      const count = (st: string) => rows.filter((r) => r.state === st).length;
      return {
        data: { assignments: rows.slice(0, 15), note: "Marks appear only when the teacher has released them." },
        blocks: [
          { type: "stats", items: [{ label: "To do", value: count("to do") + count("redo requested") }, { label: "Overdue", value: count("overdue") }, { label: "Submitted", value: count("submitted") }, { label: "Graded", value: count("graded") }] },
          { type: "links", items: rows.filter((r) => ["to do", "overdue", "redo requested"].includes(r.state)).slice(0, 5).map((r) => ({ label: r.title, href: `/student/assignments/${r.id}`, hint: `${r.subject} · due ${r.due} · ${r.state}` })) },
        ],
      };
    },
  },
  {
    name: "my_quiz_performance",
    description: "The student's own quiz performance over time: attempts, average, best, trend, strongest and weakest topics. Includes Copilot practice quizzes and platform quizzes. ALWAYS call this before answering anything about quiz scores, progress, strengths or weaknesses.",
    parameters: none,
    roles: ["STUDENT"],
    async run(s) {
      const p = await practiceSummary(s.userId, s.institutionId);
      if (!p.attempts) return { data: { attempts: 0, note: "No quizzes finished yet. Offer to start a practice quiz right now." } };
      return {
        data: { attempts: p.attempts, averagePercent: p.average, bestPercent: p.best, lastQuiz: p.last, weakTopics: p.weak, strongTopics: p.strong, byTopic: p.topics.slice(0, 8) },
        blocks: [
          { type: "stats", items: [{ label: "Quizzes", value: p.attempts }, { label: "Average", value: `${p.average}%` }, { label: "Best", value: `${p.best}%` }] },
          ...(p.trend.length > 1 ? [{ type: "bar" as const, title: "Recent quiz scores (%)", rows: p.trend.map((t) => ({ label: t.label, value: t.value })) }] : []),
          ...(p.topics.length ? [{ type: "bar" as const, title: "By topic (%)", rows: p.topics.slice(0, 6).map((t) => ({ label: t.topic, value: t.pct })) }] : []),
          { type: "links", items: [{ label: "Open my quizzes", href: "/student/quizzes" }, { label: "Open my portfolio", href: "/student/portfolio" }] },
        ],
      };
    },
  },
  {
    name: "my_portfolio",
    description: "The student's own portfolio summary: headline and latest verified entries (quizzes, graded assignments, achievements).",
    parameters: none,
    roles: ["STUDENT"],
    async run(s) {
      const c = await studentCtx(s.userId);
      if (!c) return { data: { error: "No student profile." } };
      const p = await prisma.studentPortfolio.findUnique({ where: { studentId: c.studentId }, include: { entries: { orderBy: { occurredAt: "desc" }, take: 8 } } });
      const entries = (p?.entries ?? []).map((e) => ({ type: e.type, title: e.title, summary: e.summary, verified: e.verified, date: when(e.occurredAt) }));
      return {
        data: { headline: p?.headline ?? null, entries },
        blocks: [{ type: "stats", items: [{ label: "Entries", value: entries.length }, { label: "Verified", value: entries.filter((e) => e.verified).length }] }, { type: "links", items: [{ label: "Open my portfolio", href: "/student/portfolio" }] }],
      };
    },
  },
  {
    name: "my_lessons",
    description: "Subjects with their teachers and what the teachers recently taught. Students: their own class. Teachers: lessons they logged. Use for 'what was taught today', 'what are my subjects', 'what is the homework', 'who teaches X'.",
    parameters: { type: "object", properties: { days: { type: "number", description: "Look back this many days (default 7)" } }, additionalProperties: false },
    roles: ["STUDENT", "TEACHER"],
    async run(s, args) {
      const days = Math.min(30, Math.max(1, Number(args.days) || 7));
      if (s.role === "STUDENT") {
        const c = await studentCtx(s.userId);
        if (!c?.divisionId) return { data: { error: "Not enrolled in a class." } };
        const [subjects, lessons] = await Promise.all([subjectsWithTeachers(c.divisionId), recentLessons(c.divisionId, days, 20)]);
        return {
          data: { subjects, lessons, note: lessons.length ? undefined : "No lessons have been logged recently. Say so and offer to explain a topic if the student names it." },
          blocks: lessons.length ? [{ type: "links", items: lessons.slice(0, 5).map((l) => ({ label: `${l.subject}: ${l.topic}`, href: "/student/assignments", hint: l.today ? "Today" : l.date })) }] : [],
        };
      }
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (!t) return { data: { error: "No teacher profile." } };
      const rows = await prisma.lessonLog.findMany({ where: { teacherId: t.id, date: { gte: new Date(todayUtc().getTime() - days * 86400000) } }, orderBy: { date: "desc" }, take: 20, select: { topic: true, date: true, summary: true, divisionId: true, subjectId: true } });
      return { data: { logged: rows.map((r) => ({ topic: r.topic, date: r.date.toISOString().slice(0, 10), summary: r.summary })), note: rows.length ? undefined : "Nothing logged yet. Offer to log today's lesson with propose_action log_lesson." } };
    },
  },
  {
    name: "at_risk_students",
    description: "Students who need attention, found by rules (attendance under 75% in 30 days, quiz average falling 15+ points, 2+ overdue assignments). Teachers see their own classes, admins the whole school. Use for 'who is struggling', 'at risk', 'falling behind'.",
    parameters: none,
    roles: ["TEACHER", "ADMIN", "SUPER_ADMIN"],
    async run(s) {
      let divisionIds: string[] | undefined;
      if (s.role === "TEACHER") {
        const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
        if (!t) return { data: { error: "No teacher profile." } };
        divisionIds = (await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { divisionId: true }, distinct: ["divisionId"] })).map((d) => d.divisionId);
      }
      const rows = await atRiskStudents(s.institutionId, divisionIds, 12);
      return {
        data: { count: rows.length, students: rows.map((r) => ({ name: r.name, class: r.cls, level: r.level, reasons: r.reasons })), note: rows.length ? "Suggest one kind next step per student." : "Nobody is flagged. Say so." },
        blocks: rows.length ? [{ type: "students", items: rows.slice(0, 8).map((r) => ({ name: r.name, code: r.code, cls: `${r.cls} · ${r.reasons[0]}`, status: r.level === "high" ? "AT RISK" : "WATCH", href: s.role === "TEACHER" ? `/teacher/portfolio/${r.studentId}` : `/admin/people/students/${r.userId}` })) }] : [],
      };
    },
  },
  {
    name: "my_classes",
    description: "Teacher: the subject and class pairs they teach, with the ids needed for propose_action (create_assignment, create_quiz, announce_class, log_lesson). Call it before proposing any of those; never guess ids.",
    parameters: none,
    roles: ["TEACHER"],
    async run(s) {
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (!t) return { data: { error: "No teacher profile." } };
      const rows = await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { subjectId: true, divisionId: true, subject: { select: { name: true } }, division: { select: { name: true, class: { select: { name: true } } } } } });
      const seen = new Set<string>();
      const pairs = rows.filter((r) => { const k = `${r.subjectId}|${r.divisionId}`; if (seen.has(k)) return false; seen.add(k); return true; }).map((r) => ({ subjectId: r.subjectId, divisionId: r.divisionId, label: `${r.division.class.name} ${r.division.name} - ${r.subject.name}` }));
      return { data: { classes: pairs } };
    },
  },
  {
    name: "assignments_to_grade",
    description: "Teacher: submissions waiting for a grade, grouped by assignment, plus assignments due soon.",
    parameters: none,
    roles: ["TEACHER"],
    async run(s) {
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (!t) return { data: { error: "No teacher profile." } };
      const list = await prisma.assignment.findMany({
        where: { institutionId: s.institutionId, teacherId: t.id, status: { in: ["PUBLISHED", "CLOSED"] } },
        orderBy: { dueAt: "desc" }, take: 20,
        include: { division: { select: { name: true, class: { select: { name: true } } } }, submissions: { select: { studentId: true, grade: { select: { status: true } } } } },
      });
      const rows = list.map((a) => ({ id: a.id, title: a.title, cls: `${a.division.class.name} ${a.division.name}`, due: when(a.dueAt), submitted: new Set(a.submissions.map((x) => x.studentId)).size, ungraded: a.submissions.filter((x) => !x.grade).length, drafts: a.submissions.filter((x) => x.grade?.status === "DRAFT").length }));
      const pending = rows.filter((r) => r.ungraded > 0 || r.drafts > 0);
      return {
        data: { needingAttention: pending, totalAssignments: rows.length },
        blocks: [
          { type: "stats", items: [{ label: "To grade", value: rows.reduce((n, r) => n + r.ungraded, 0) }, { label: "Draft grades", value: rows.reduce((n, r) => n + r.drafts, 0) }, { label: "Active assignments", value: rows.length }] },
          { type: "links", items: pending.slice(0, 5).map((r) => ({ label: r.title, href: `/teacher/assignments/${r.id}`, hint: `${r.cls} · ${r.ungraded} to grade${r.drafts ? `, ${r.drafts} drafts` : ""}` })) },
        ],
      };
    },
  },
  {
    name: "quiz_analytics",
    description: "Teacher: results of the quizzes they created (takers, average percent, hardest question).",
    parameters: none,
    roles: ["TEACHER"],
    async run(s) {
      const quizzes = await prisma.quiz.findMany({
        where: { institutionId: s.institutionId, createdById: s.userId }, orderBy: { createdAt: "desc" }, take: 10,
        include: { questions: { include: { question: { select: { prompt: true } } } }, sessions: { select: { responses: { select: { studentId: true, questionId: true, score: true, isCorrect: true } } } } },
      });
      const rows = quizzes.map((q) => {
        const total = q.questions.reduce((n, x) => n + Number(x.points), 0);
        const rs = q.sessions.flatMap((x) => x.responses);
        const by = new Map<string, number>();
        for (const r of rs) by.set(r.studentId, (by.get(r.studentId) ?? 0) + Number(r.score ?? 0));
        const hardest = q.questions.map((x) => { const a = rs.filter((r) => r.questionId === x.questionId); return { prompt: x.question.prompt.slice(0, 80), pct: a.length ? Math.round((a.filter((r) => r.isCorrect).length / a.length) * 100) : null }; }).filter((x) => x.pct !== null).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];
        return { id: q.id, title: q.title, takers: by.size, avg: by.size && total ? Math.round(([...by.values()].reduce((a, b) => a + b, 0) / by.size / total) * 100) : null, hardest };
      });
      return {
        data: { quizzes: rows },
        blocks: [
          ...(rows.some((r) => r.avg !== null) ? [{ type: "bar" as const, title: "Average score per quiz (%)", rows: rows.filter((r) => r.avg !== null).map((r) => ({ label: r.title.slice(0, 24), value: r.avg ?? 0 })) }] : []),
          { type: "links", items: rows.slice(0, 4).map((r) => ({ label: r.title, href: `/teacher/quizzes/${r.id}`, hint: `${r.takers} taken` })) },
        ],
      };
    },
  },
  {
    name: "student_performance",
    description: "Teacher: full details of ONE student found by name or code (class, attendance, quizzes, released assignment marks). Searches every class the teacher teaches, matches any part of the name, and lists the candidates when several students share a name (then call again with the student code). Only if it says the student is outside the teacher's classes may you say so.",
    parameters: { type: "object", properties: { name: { type: "string", description: "Student name or code" } }, required: ["name"], additionalProperties: false },
    roles: ["TEACHER"],
    async run(s, args) {
      const name = str(args.name, 60);
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      if (!name || !t) return { data: { error: "Give a student name." } };
      const words = name.split(/\s+/).filter(Boolean).slice(0, 4);
      const byName = { AND: words.map((w) => ({ user: { fullName: { contains: w } } })) };
      const sel = { id: true, userId: true, studentCode: true, user: { select: { fullName: true } }, enrollments: { where: { status: "ACTIVE" as const }, take: 1, select: { divisionId: true, division: { select: { name: true, class: { select: { name: true } } } } } } };
      const mine = await prisma.studentProfile.findMany({
        where: { institutionId: s.institutionId, OR: [{ studentCode: name }, byName], enrollments: { some: { status: "ACTIVE", division: { teacherAssignments: { some: { teacherId: t.id } } } } } },
        take: 6, select: sel,
      });
      if (!mine.length) {
        const elsewhere = await prisma.studentProfile.count({ where: { institutionId: s.institutionId, OR: [{ studentCode: name }, byName] } });
        return { data: { error: elsewhere ? "A student with that name exists in the school but is not in any class this teacher teaches, so their details are not available here. Say exactly that." : "No student with that name exists in the school. Ask the teacher to check the spelling or give the student code." } };
      }
      const label = (r: (typeof mine)[number]) => (r.enrollments[0] ? `${r.enrollments[0].division.class.name} ${r.enrollments[0].division.name}` : "No class");
      if (mine.length > 1) {
        return { data: { multiple: mine.map((r) => ({ name: r.user.fullName, code: r.studentCode, class: label(r) })), instruction: "Several students match. List them and ask which one, then call again with the student code." }, blocks: [{ type: "students", items: mine.map((r) => ({ name: r.user.fullName, code: r.studentCode, cls: label(r), status: "ACTIVE", href: `/teacher/portfolio/${r.id}` })) }] };
      }
      const st = mine[0];
      const [p, grades, att] = await Promise.all([
        practiceSummary(st.userId, s.institutionId),
        prisma.grade.findMany({ where: { status: "RELEASED", submission: { studentId: st.id, assignment: { teacherId: t.id } } }, take: 10, orderBy: { gradedAt: "desc" }, select: { marks: true, submission: { select: { assignment: { select: { title: true, maxMarks: true } } } } } }),
        prisma.attendance.groupBy({ by: ["status"], where: { studentId: st.id, date: { gte: new Date(Date.now() - 30 * 86400000) } }, _count: { _all: true } }).catch(() => []),
      ]);
      const marks = grades.map((g) => ({ title: g.submission.assignment.title, pct: Math.round((Number(g.marks) / Number(g.submission.assignment.maxMarks)) * 100) }));
      const total = att.reduce((n, x) => n + x._count._all, 0);
      const here = att.filter((x) => x.status === "PRESENT" || x.status === "LATE").reduce((n, x) => n + x._count._all, 0);
      const attendance = total ? Math.round((here / total) * 100) : null;
      return {
        data: { student: st.user.fullName, code: st.studentCode, class: label(st), attendanceLast30DaysPercent: attendance, quizAttempts: p.attempts, quizAveragePercent: p.average, weakTopics: p.weak, strongTopics: p.strong, assignmentMarks: marks },
        blocks: [
          { type: "students", items: [{ name: st.user.fullName, code: st.studentCode, cls: label(st), status: "ACTIVE", href: `/teacher/portfolio/${st.id}` }] },
          { type: "stats", items: [{ label: "Attendance (30d)", value: attendance === null ? "—" : `${attendance}%` }, { label: "Quiz average", value: p.average === null ? "—" : `${p.average}%` }, { label: "Graded work", value: marks.length }] },
          ...(marks.length ? [{ type: "bar" as const, title: `${st.user.fullName}: assignment marks (%)`, rows: marks.map((m) => ({ label: m.title.slice(0, 24), value: m.pct })) }] : []),
        ],
      };
    },
  },
];

export const LEARNING_LABELS: Record<string, { label: string; agent?: string }> = {
  my_assignments: { label: "Checking your assignments", agent: "Assignments agent" },
  my_quiz_performance: { label: "Reviewing your quiz history", agent: "Performance agent" },
  my_portfolio: { label: "Opening your portfolio", agent: "Portfolio agent" },
  at_risk_students: { label: "Checking who needs support", agent: "Insights agent" },
  my_lessons: { label: "Checking what was taught", agent: "Lessons agent" },
  my_classes: { label: "Checking the classes you teach", agent: "Classes agent" },
  assignments_to_grade: { label: "Finding work to grade", agent: "Grading agent" },
  quiz_analytics: { label: "Analysing quiz results", agent: "Analytics agent" },
  student_performance: { label: "Looking up the student's progress", agent: "Performance agent" },
};
