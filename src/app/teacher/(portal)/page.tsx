import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { getDaySchedule } from "@/features/schedule/today";
import { ScheduleView } from "@/features/schedule/ScheduleView";
import { Hero } from "@/components/dashboard/OverviewKit";
import { PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { ComingSoon, StatGrid } from "@/components/dashboard/StatGrid";
import { fmtDateTime, greetingNow } from "@/lib/format";

export const metadata = { title: "Teacher home · Campus 2035" };

export default async function Page() {
  const s = await requireRolePage(["TEACHER"], "/teacher/login");
  const [schedule, notes] = await Promise.all([
    getDaySchedule({ institutionId: s.institutionId, userId: s.userId, who: "teacher" }),
    prisma.notification.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
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
          { icon: "bell", label: "Unread notifications", value: notes.filter((n) => !n.readAt).length },
        ]}
      />
      <ScheduleView schedule={schedule} audience="teacher" />
      <SectionCard title="Recent notifications" icon="bell">
        {notes.length === 0 ? <p className="cd-muted">Nothing new.</p> : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {notes.map((n) => <li key={n.id}><strong>{n.title}</strong>{n.body ? ` — ${n.body}` : ""} <small className="cd-muted">{fmtDateTime(n.createdAt)}</small></li>)}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Coming next" icon="sparkles">
        <ComingSoon items={[
          { icon: "video", label: "Start live class", text: "Run a class from the smart board.", phase: 4 },
          { icon: "checkSquare", label: "Attendance", text: "Mark and review attendance.", phase: 4 },
          { icon: "clipboard", label: "Assignments", text: "Create and grade assignments.", phase: 5 },
          { icon: "quiz", label: "Quizzes", text: "Run live and scheduled quizzes.", phase: 5 },
          { icon: "read", label: "Library", text: "Share study material.", phase: 5 },
          { icon: "sparkles", label: "AI Copilot", text: "Plan lessons and summaries.", phase: 7 },
        ]} />
      </SectionCard>
    </PageWrap>
  );
}
