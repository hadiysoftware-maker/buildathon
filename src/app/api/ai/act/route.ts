import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/auth/rate-limit";
import { audit } from "@/lib/auth/log";
import { prisma } from "@/lib/db";
import { readAct } from "@/lib/ai/act-token";
import { saveAssignment, type SaveAssignmentInput } from "@/features/assignments/actions";
import { saveQuiz, type SaveQuizInput } from "@/features/quizzes/actions";
import { addPortfolioEntry } from "@/features/portfolio/actions";
import { notify } from "@/features/notify";

const Body = z.object({ token: z.string().min(20).max(40_000) });

/**
 * Executes a Copilot proposal after the user pressed Confirm. The token is signed for this user, this kind and these exact
 * parameters, and each kind goes through the same server action as the normal screens, so permissions, scoping and audit are identical.
 */
export async function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const s = await requirePermission("ai.use");
    if (!(await rateLimit(`aiact:${s.userId}`, 20, 60 * 60_000, { failOpen: true }))) return NextResponse.json({ error: "Too many changes from chat this hour." }, { status: 429 });
    const { token } = Body.parse(await req.json());
    const act = readAct(s.userId, token);
    if (!act) return NextResponse.json({ error: "This confirmation expired. Ask again." }, { status: 400 });
    const p = act.p;

    let message = "Done.";
    let link: { label: string; href: string } | undefined;
    switch (act.k) {
      case "create_assignment": {
        const r = await saveAssignment({ ...(p as unknown as SaveAssignmentInput), id: undefined, publish: false });
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        message = "Saved as a draft assignment.";
        link = { label: "Review and publish", href: `/teacher/assignments/${r.data?.id}` };
        break;
      }
      case "create_quiz": {
        const r = await saveQuiz({ ...(p as unknown as SaveQuizInput), id: undefined, publish: false, source: "AI_GENERATED" });
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        message = "Saved as a draft quiz.";
        link = { label: "Review and publish", href: `/teacher/quizzes/${r.data?.id}` };
        break;
      }
      case "announce_class": {
        const divisionId = String(p.divisionId ?? "");
        const title = String(p.title ?? "").slice(0, 120);
        const body = String(p.body ?? "").slice(0, 900);
        if (!title) return NextResponse.json({ error: "The announcement needs a title." }, { status: 400 });
        const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
        const teaches = t ? await prisma.teacherAssignment.count({ where: { teacherId: t.id, divisionId } }) : 0;
        if (!teaches) return NextResponse.json({ error: "You can only message classes you teach." }, { status: 403 });
        const rows = await prisma.enrollment.findMany({ where: { divisionId, status: "ACTIVE" }, select: { student: { select: { userId: true } } } });
        await notify(s.institutionId, rows.map((r) => r.student.userId), { type: "announcement", title, body });
        message = `Sent to ${rows.length} student${rows.length === 1 ? "" : "s"}.`;
        break;
      }
      case "log_lesson": {
        const divisionId = String(p.divisionId ?? "");
        const subjectId = String(p.subjectId ?? "");
        const topic = String(p.topic ?? "").trim().slice(0, 200);
        if (!topic) return NextResponse.json({ error: "Say what was taught." }, { status: 400 });
        const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
        const teaches = t ? await prisma.teacherAssignment.count({ where: { teacherId: t.id, divisionId, subjectId } }) : 0;
        if (!t || !teaches) return NextResponse.json({ error: "You can only log lessons for classes and subjects you teach." }, { status: 403 });
        const d = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date ?? "")) ? new Date(`${p.date}T00:00:00.000Z`) : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
        const row = await prisma.lessonLog.create({ data: { institutionId: s.institutionId, divisionId, subjectId, teacherId: t.id, date: d, topic, summary: String(p.summary ?? "").trim().slice(0, 1000) || null, homework: String(p.homework ?? "").trim().slice(0, 500) || null } });
        message = "Lesson recorded. Students can now ask Nova about it.";
        await audit({ institutionId: s.institutionId, actorId: s.userId, action: "lesson.log", entityType: "LessonLog", entityId: row.id });
        break;
      }
      case "add_portfolio": {
        const r = await addPortfolioEntry({ type: String(p.type ?? "ACHIEVEMENT") as "ACHIEVEMENT", title: String(p.title ?? ""), summary: String(p.summary ?? ""), occurredAt: String(p.occurredAt ?? new Date().toISOString().slice(0, 10)) });
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        message = "Added to your portfolio.";
        link = { label: "Open portfolio", href: "/student/portfolio" };
        break;
      }
      case "mark_notifications_read": {
        const r = await prisma.notification.updateMany({ where: { userId: s.userId, readAt: null }, data: { readAt: new Date() } });
        message = `Marked ${r.count} as read.`;
        break;
      }
    }
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: `copilot.${act.k}`, entityType: "AIAction", entityId: act.k });
    return NextResponse.json({ ok: true, message, link });
  });
}
