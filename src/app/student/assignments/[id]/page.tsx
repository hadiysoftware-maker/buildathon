import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { storageConfigured } from "@/lib/storage/r2";
import { PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { SubmitForm } from "@/features/assignments/SubmitForm";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Assignment · EduCore" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const st = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const enr = st ? await prisma.enrollment.findFirst({ where: { studentId: st.id, status: "ACTIVE" }, select: { divisionId: true } }) : null;
  const a = st && enr
    ? await prisma.assignment.findFirst({
        where: { id, institutionId: s.institutionId, divisionId: enr.divisionId, status: { in: ["PUBLISHED", "CLOSED"] } },
        include: {
          subject: { select: { name: true } }, attachments: { include: { file: { select: { id: true, fileName: true } } } },
          submissions: { where: { studentId: st.id }, orderBy: { attempt: "desc" }, include: { grade: true, files: { include: { file: { select: { id: true, fileName: true } } } }, feedback: { orderBy: { createdAt: "asc" } } } },
        },
      })
    : null;
  if (!a) notFound();

  const last = a.submissions[0];
  const now = new Date();
  const redo = last?.status === "RESUBMIT_REQUESTED";
  const open = a.status === "PUBLISHED" && (a.dueAt > now || a.allowLate) && (!last || a.allowResubmission || redo);
  const released = last?.grade?.status === "RELEASED" ? last.grade : null;

  return (
    <PageWrap>
      <PageHeader eyebrow={<Link href="/student/assignments">← Assignments</Link>} title={a.title} description={`${a.subject.name} · ${Number(a.maxMarks)} marks · due ${fmtDateTime(a.dueAt)}`}
        actions={released ? <PillChip tone="ok">{Number(released.marks)} / {Number(a.maxMarks)}</PillChip> : last ? <PillChip tone="neutral">{redo ? "redo requested" : "submitted"}</PillChip> : undefined} />
      <SectionCard title="Instructions" icon="clipboard">
        <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{a.instructions}</p>
        {a.attachments.length > 0 && <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{a.attachments.map((x) => <a key={x.file.id} className="ds-btn outline sm" href={`/api/files/${x.file.id}`} target="_blank" rel="noreferrer">{x.file.fileName}</a>)}</p>}
      </SectionCard>
      {last && (
        <SectionCard title="Your submission" icon="checkSquare">
          <small className="cd-muted">Attempt {last.attempt} · {fmtDateTime(last.submittedAt)}{last.isLate ? " · late" : ""}</small>
          {last.textAnswer && <p style={{ whiteSpace: "pre-wrap" }}>{last.textAnswer}</p>}
          {last.files.length > 0 && <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{last.files.map((f) => <a key={f.file.id} className="ds-btn outline sm" href={`/api/files/${f.file.id}`} target="_blank" rel="noreferrer">{f.file.fileName}</a>)}</p>}
          {(released || redo) && last.feedback.length > 0 && (
            <div className="cd-banner" role="status"><strong>Teacher feedback:</strong> {last.feedback.map((f) => f.body).join(" · ")}</div>
          )}
        </SectionCard>
      )}
      {open ? (
        <SectionCard title={last ? "Submit again" : "Submit your work"} icon="upload">
          {a.dueAt < now && <p className="cd-muted">The deadline has passed. This will be marked late.</p>}
          <SubmitForm assignmentId={a.id} storageReady={storageConfigured()} resubmit={!!last} />
        </SectionCard>
      ) : !last ? <div className="cd-banner" data-tone="warn" role="status">Submissions are closed for this assignment.</div> : null}
    </PageWrap>
  );
}
