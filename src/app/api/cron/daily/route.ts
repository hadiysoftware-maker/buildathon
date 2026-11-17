import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { notify } from "@/features/notify";
import { atRiskStudents } from "@/features/risk/risk";

export const maxDuration = 60;

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Daily job (Vercel Cron, sent with `Authorization: Bearer CRON_SECRET`). No AI is used here:
 * 1. students get one reminder for each assignment due in the next 24 hours that they have not submitted;
 * 2. teachers get one note when students in their classes are flagged by the at-risk rules.
 * Reminders are skipped when one was already sent in the last 20 hours, so a re-run never doubles them.
 */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600_000);
  const recent = new Date(now.getTime() - 20 * 3600_000);
  let reminders = 0;
  let digests = 0;

  const due = await prisma.assignment.findMany({ where: { status: "PUBLISHED", dueAt: { gt: now, lte: soon } }, select: { id: true, title: true, institutionId: true, divisionId: true, dueAt: true }, take: 500 });
  for (const a of due) {
    const link = `/student/assignments/${a.id}`;
    const students = await prisma.enrollment.findMany({ where: { divisionId: a.divisionId, status: "ACTIVE", student: { institutionId: a.institutionId, submissions: { none: { assignmentId: a.id } } } }, select: { student: { select: { userId: true } } } });
    const already = new Set((await prisma.notification.findMany({ where: { type: "assignment.due", link, createdAt: { gte: recent } }, select: { userId: true } })).map((n) => n.userId));
    const ids = students.map((x) => x.student.userId).filter((u) => !already.has(u));
    await notify(a.institutionId, ids, { type: "assignment.due", title: `Due soon: ${a.title}`, body: `Due ${a.dueAt.toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" })}`, link });
    reminders += ids.length;
  }

  const teachers = await prisma.teacherProfile.findMany({ where: { user: { status: "ACTIVE" } }, select: { userId: true, institutionId: true, assignments: { select: { divisionId: true } } }, take: 300 });
  for (const t of teachers) {
    const divs = [...new Set(t.assignments.map((x) => x.divisionId))];
    if (!divs.length) continue;
    if (await prisma.notification.count({ where: { userId: t.userId, type: "risk.digest", createdAt: { gte: recent } } })) continue;
    const list = await atRiskStudents(t.institutionId, divs, 50);
    if (!list.length) continue;
    await notify(t.institutionId, [t.userId], { type: "risk.digest", title: `${list.length} student${list.length === 1 ? "" : "s"} may need support`, body: list.slice(0, 3).map((x) => x.name).join(", "), link: "/teacher" });
    digests += 1;
  }
  return NextResponse.json({ ok: true, reminders, digests });
}
