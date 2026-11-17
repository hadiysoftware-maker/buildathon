import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { GradingPanel, type SubmissionRow } from "@/features/assignments/GradingPanel";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Assignment · EduCore" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePagePermission("assignments.manage", "/teacher/login");
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const a = t
    ? await prisma.assignment.findFirst({
        where: { id, institutionId: s.institutionId, teacherId: t.id },
        include: {
          subject: { select: { name: true } }, division: { select: { name: true, class: { select: { name: true } } } },
          attachments: { include: { file: { select: { id: true, fileName: true } } } },
          submissions: { orderBy: [{ studentId: "asc" }, { attempt: "desc" }], include: { grade: true, files: { include: { file: { select: { id: true, fileName: true } } } }, feedback: { orderBy: { createdAt: "asc" } }, student: { select: { studentCode: true, user: { select: { fullName: true } } } } } },
        },
      })
    : null;
  if (!a) notFound();

  const enrolled = await prisma.enrollment.findMany({ where: { divisionId: a.divisionId, status: "ACTIVE" }, select: { studentId: true, student: { select: { studentCode: true, user: { select: { fullName: true } } } } } });
  const latest = new Map<string, (typeof a.submissions)[number]>();
  for (const sub of a.submissions) if (!latest.has(sub.studentId)) latest.set(sub.studentId, sub);
  const rows: SubmissionRow[] = [...latest.values()].map((x) => ({
    id: x.id, student: x.student.user.fullName, code: x.student.studentCode, status: x.status, isLate: x.isLate, attempt: x.attempt, submittedAt: x.submittedAt.toISOString(), text: x.textAnswer,
    files: x.files.map((f) => ({ id: f.file.id, name: f.file.fileName })), marks: x.grade ? Number(x.grade.marks) : null, gradeStatus: x.grade?.status ?? null, feedback: x.feedback.map((f) => f.body),
  }));
  const missing = enrolled.filter((e) => !latest.has(e.studentId)).map((e) => ({ name: e.student.user.fullName, code: e.student.studentCode }));
  const graded = rows.filter((r) => r.marks !== null);
  const avg = graded.length ? graded.reduce((n, r) => n + (r.marks ?? 0), 0) / graded.length : null;

  return (
    <PageWrap>
      <PageHeader eyebrow={<Link href="/teacher/assignments">← Assignments</Link>} title={a.title} description={`${a.division.class.name} ${a.division.name} · ${a.subject.name} · ${Number(a.maxMarks)} marks · due ${fmtDateTime(a.dueAt)}`}
        actions={<PillChip tone={a.status === "PUBLISHED" ? "ok" : a.status === "DRAFT" ? "warn" : "neutral"}>{a.status.toLowerCase()}</PillChip>} />
      <SectionCard title="Brief" icon="clipboard">
        <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{a.instructions}</p>
        {a.attachments.length > 0 && <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{a.attachments.map((x) => <a key={x.file.id} className="ds-btn outline sm" href={`/api/files/${x.file.id}`} target="_blank" rel="noreferrer">{x.file.fileName}</a>)}</p>}
        <small className="cd-muted">{rows.length} of {enrolled.length} submitted · {graded.length} graded{avg !== null ? ` · class average ${avg.toFixed(1)} / ${Number(a.maxMarks)}` : ""}</small>
      </SectionCard>
      <GradingPanel assignmentId={a.id} maxMarks={Number(a.maxMarks)} rows={rows} missing={missing} />
    </PageWrap>
  );
}
