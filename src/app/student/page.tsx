import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { getDaySchedule } from "@/features/schedule/today";
import { ScheduleView } from "@/features/schedule/ScheduleView";
import { Hero } from "@/components/dashboard/OverviewKit";
import { PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { ComingSoon, StatGrid } from "@/components/dashboard/StatGrid";
import { fmtDateTime, greetingNow } from "@/lib/format";

export const metadata = { title: "Learning home · EduCore" };

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const [schedule, notes, profile] = await Promise.all([
    getDaySchedule({ institutionId: s.institutionId, userId: s.userId, who: "student" }),
    prisma.notification.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.studentProfile.findUnique({
      where: { userId: s.userId },
      include: { enrollments: { where: { status: "ACTIVE" }, take: 1, orderBy: { enrolledAt: "desc" }, include: { division: { include: { class: { select: { name: true } } } } } } },
    }),
  ]);
  const en = profile?.enrollments[0];
  const week = inDays(7);
  const [dueSoon, openQuizzes] = en && profile
    ? await Promise.all([
        prisma.assignment.count({ where: { institutionId: s.institutionId, divisionId: en.divisionId, status: "PUBLISHED", dueAt: { gte: inDays(0), lte: week }, submissions: { none: { studentId: profile.id } } } }),
        prisma.quiz.count({ where: { institutionId: s.institutionId, status: "PUBLISHED", OR: [{ divisionId: en.divisionId }, { divisionId: null }], sessions: { some: { status: "LIVE", responses: { none: { studentId: profile.id } } } } } }),
      ])
    : [0, 0];
  const classes = schedule.rows.filter((r) => r.kind === "CLASS" && r.status !== "cancelled");
  return (
    <PageWrap>
      <Hero
        eyebrow={greetingNow()}
        title={s.user.fullName}
        text={en ? `${en.division.class.name} · Division ${en.division.name} · Roll ${en.rollNumber ?? "—"}` : "You are not enrolled in a class yet. Please ask your administrator."}
      />
      <StatGrid
        items={[
          { icon: "calendar", label: "Classes today", value: classes.length },
          { icon: "play", label: "Current class", value: schedule.current?.subject ?? "—", sub: schedule.current ? `${schedule.current.startTime}–${schedule.current.endTime}` : undefined },
          { icon: "clock", label: "Next class", value: schedule.next?.subject ?? "—", sub: schedule.next ? `at ${schedule.next.startTime}` : undefined },
          { icon: "clipboard", label: "Due this week", value: dueSoon, sub: "assignments to submit" },
          { icon: "quiz", label: "Open quizzes", value: openQuizzes },
          { icon: "bell", label: "Unread notifications", value: notes.filter((n) => !n.readAt).length },
        ]}
      />
      <ScheduleView schedule={schedule} audience="student" />
      <SectionCard title="Recent notifications" icon="bell">
        {notes.length === 0 ? <p className="cd-muted">Nothing new.</p> : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {notes.map((n) => <li key={n.id}><strong>{n.title}</strong>{n.body ? ` — ${n.body}` : ""} <small className="cd-muted">{fmtDateTime(n.createdAt)}</small></li>)}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Explore" icon="sparkles">
        <ComingSoon items={[
          { icon: "checkSquare", label: "Attendance", text: "See your attendance record.", href: "/student/attendance" },
          { icon: "clipboard", label: "Assignments", text: "Submit and track work.", href: "/student/assignments" },
          { icon: "quiz", label: "Quizzes", text: "Take timed quizzes and see your score.", href: "/student/quizzes" },
          { icon: "read", label: "Library", text: "Browse study material.", href: "/student/library" },
          { icon: "sparkles", label: "AI Copilot", text: "Ask Nova, attach files, get quizzes and reports.", href: "/student/copilot" },
          { icon: "award", label: "Portfolio", text: "Your achievements and growth.", href: "/student/portfolio" },
        ]} />
      </SectionCard>
    </PageWrap>
  );
}
