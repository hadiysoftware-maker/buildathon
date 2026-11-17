import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";

export const metadata = { title: "Calendar · EduCore" };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const st = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const enr = st ? await prisma.enrollment.findFirst({ where: { studentId: st.id, status: "ACTIVE" }, select: { divisionId: true } }) : null;
  const from = new Date(new Date().toDateString());
  const to = new Date(from.getTime() + 14 * 86400000);
  const [assignments, quizzes] = enr && st
    ? await Promise.all([
        prisma.assignment.findMany({ where: { institutionId: s.institutionId, divisionId: enr.divisionId, status: "PUBLISHED", dueAt: { gte: from, lt: to } }, orderBy: { dueAt: "asc" }, include: { subject: { select: { name: true } }, submissions: { where: { studentId: st.id }, select: { id: true }, take: 1 } } }),
        prisma.quiz.findMany({ where: { institutionId: s.institutionId, divisionId: enr.divisionId, status: "PUBLISHED" }, orderBy: { scheduledFor: "asc" }, include: { subject: { select: { name: true } } }, take: 20 }),
      ])
    : [[], []];
  const days = Array.from({ length: 14 }, (_, i) => new Date(from.getTime() + i * 86400000));
  const items = new Map<string, { kind: "due" | "quiz"; title: string; sub: string; href: string; done?: boolean }[]>();
  const push = (d: Date, v: { kind: "due" | "quiz"; title: string; sub: string; href: string; done?: boolean }) => items.set(dayKey(d), [...(items.get(dayKey(d)) ?? []), v]);
  for (const a of assignments) push(a.dueAt, { kind: "due", title: a.title, sub: `${a.subject.name} · due`, href: `/student/assignments/${a.id}`, done: a.submissions.length > 0 });
  for (const q of quizzes) push(q.scheduledFor && q.scheduledFor >= from ? q.scheduledFor : from, { kind: "quiz", title: q.title, sub: `${q.subject.name} · quiz open`, href: `/student/quizzes/${q.id}` });
  return (
    <PageWrap>
      <PageHeader eyebrow="Learning" title="Calendar" description="Homework due dates and open quizzes for the next two weeks." />
      <SectionCard title="Next 14 days" icon="calendar">
        <ul className="cal">
          {days.map((d, i) => {
            const list = items.get(dayKey(d)) ?? [];
            return (
              <li key={i} className="cal-day" data-today={i === 0 ? "1" : "0"} data-empty={list.length ? "0" : "1"}>
                <div className="cal-date"><b>{d.toLocaleDateString("en-IN", { day: "numeric" })}</b><small>{d.toLocaleDateString("en-IN", { weekday: "short", month: "short" })}</small></div>
                <div className="cal-items">
                  {list.length === 0 ? <span className="cd-muted">Nothing due</span> : list.map((x, k) => (
                    <Link key={k} href={x.href} className="cal-item" data-kind={x.kind} data-done={x.done ? "1" : "0"}><strong>{x.title}</strong><small>{x.sub}{x.done ? " · submitted" : ""}</small></Link>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </PageWrap>
  );
}
