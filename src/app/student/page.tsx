import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { getDaySchedule } from "@/features/schedule/today";
import { ScheduleView } from "@/features/schedule/ScheduleView";
import { Hero } from "@/components/dashboard/OverviewKit";
import { PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { ComingSoon, StatGrid } from "@/components/dashboard/StatGrid";
import { fmtDateTime, greetingNow } from "@/lib/format";

export const metadata = { title: "Learning home · Campus 2035" };

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
      <SectionCard title="Coming next" icon="sparkles">
        <ComingSoon items={[
          { icon: "video", label: "Join live class", text: "Join from your device.", phase: 4 },
          { icon: "checkSquare", label: "Attendance", text: "See your attendance record.", phase: 4 },
          { icon: "clipboard", label: "Assignments", text: "Submit and track work.", phase: 5 },
          { icon: "quiz", label: "Quizzes", text: "Take live and scheduled quizzes.", phase: 5 },
          { icon: "read", label: "Library", text: "Browse study material.", phase: 5 },
          { icon: "award", label: "Portfolio", text: "Your achievements and growth.", phase: 6 },
        ]} />
      </SectionCard>
    </PageWrap>
  );
}
