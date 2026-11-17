import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { getDaySchedule } from "@/features/schedule/today";
import { ScheduleView } from "@/features/schedule/ScheduleView";
import { Hero } from "@/components/dashboard/OverviewKit";
import { PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { ComingSoon, StatGrid } from "@/components/dashboard/StatGrid";
import { fmtDateTime, greetingNow } from "@/lib/format";
import { AtRiskCard } from "@/features/risk/AtRiskCard";

export const metadata = { title: "Teacher home · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["TEACHER"], "/teacher/login");
  const [schedule, notes] = await Promise.all([
    getDaySchedule({ institutionId: s.institutionId, userId: s.userId, who: "teacher" }),
    prisma.notification.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const [toGrade, liveQuizzes] = t
    ? await Promise.all([
        prisma.submission.count({ where: { grade: null, assignment: { institutionId: s.institutionId, teacherId: t.id, status: { in: ["PUBLISHED", "CLOSED"] } } } }),
        prisma.quiz.count({ where: { institutionId: s.institutionId, createdById: s.userId, status: "PUBLISHED", sessions: { some: { status: "LIVE" } } } }),
      ])
    : [0, 0];
  const classes = schedule.rows.filter((r) => r.kind === "CLASS");
  const done = classes.filter((r) => r.status === "completed").length;
  return (
    <PageWrap>
      <Hero
        eyebrow={greetingNow()}
        title={s.user.fullName}
        text={schedule.current ? `Now: ${schedule.current.subject} with ${schedule.current.division}.` : schedule.next ? `Next: ${schedule.next.subject} with ${schedule.next.division} at ${schedule.next.startTime}.` : "No more classes scheduled today."}
      />
      <StatGrid
        items={[
          { icon: "calendar", label: "Classes today", value: classes.filter((r) => r.status !== "cancelled").length },
          { icon: "done", label: "Completed", value: done },
          { icon: "clock", label: "Next class", value: schedule.next?.startTime ?? "—", sub: schedule.next?.subject ?? undefined },
          { icon: "clipboard", label: "To grade", value: toGrade, sub: "submissions" },
          { icon: "quiz", label: "Live quizzes", value: liveQuizzes },
          { icon: "bell", label: "Unread notifications", value: notes.filter((n) => !n.readAt).length },
        ]}
      />
      <ScheduleView schedule={schedule} audience="teacher" />
      {t && <AtRiskCard institutionId={s.institutionId} divisionIds={(await prisma.teacherAssignment.findMany({ where: { teacherId: t.id }, select: { divisionId: true }, distinct: ["divisionId"] })).map((d) => d.divisionId)} hrefBase="/teacher/portfolio" />}
      <SectionCard title="Recent notifications" icon="bell">
        {notes.length === 0 ? <p className="cd-muted">Nothing new.</p> : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {notes.map((n) => <li key={n.id}><strong>{n.title}</strong>{n.body ? ` — ${n.body}` : ""} <small className="cd-muted">{fmtDateTime(n.createdAt)}</small></li>)}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Explore" icon="sparkles">
        <ComingSoon items={[
          { icon: "checkSquare", label: "Attendance", text: "Mark and review attendance.", href: "/teacher/attendance" },
          { icon: "clipboard", label: "Assignments", text: "Create and grade assignments.", href: "/teacher/assignments" },
          { icon: "quiz", label: "Quizzes", text: "Build timed quizzes, auto-marked.", href: "/teacher/quizzes" },
          { icon: "award", label: "Portfolios", text: "See and verify student achievements.", href: "/teacher/portfolio" },
          { icon: "read", label: "Library", text: "Share study material.", href: "/teacher/library" },
          { icon: "sparkles", label: "AI Copilot", text: "Plan lessons, quizzes and summaries.", href: "/teacher/copilot" },
        ]} />
      </SectionCard>
    </PageWrap>
  );
}
