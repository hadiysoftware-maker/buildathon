import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { EmptyState } from "@/components/ui/EmptyState";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Library · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const enr = await prisma.enrollment.findFirst({ where: { status: "ACTIVE", student: { userId: s.userId } }, select: { divisionId: true } });
  const subjectIds = enr ? (await prisma.teacherAssignment.findMany({ where: { divisionId: enr.divisionId }, select: { subjectId: true } })).map((a) => a.subjectId) : [];
  const materials = subjectIds.length
    ? await prisma.learningMaterial.findMany({
        where: { institutionId: s.institutionId, status: "PUBLISHED", subjectId: { in: subjectIds } },
        orderBy: [{ subject: { name: "asc" } }, { createdAt: "desc" }],
        include: { subject: { select: { name: true } }, file: { select: { id: true, fileName: true, deletedAt: true } } },
      })
    : [];
  const bySubject = new Map<string, typeof materials>();
  for (const m of materials) bySubject.set(m.subject.name, [...(bySubject.get(m.subject.name) ?? []), m]);

  return (
    <PageWrap>
      <PageHeader eyebrow="Learning" title="Library" description="Notes, slides and videos shared by your teachers." />
      {bySubject.size === 0 ? (
        <EmptyState title="Nothing shared yet" hint={enr ? "When your teachers publish material for your subjects it will show up here." : "You are not enrolled in a class yet."} />
      ) : (
        [...bySubject.entries()].map(([subject, list]) => (
          <SectionCard key={subject} title={subject} icon="read" count={list.length}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {list.filter((m) => m.file && !m.file.deletedAt).map((m) => (
                <li key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <span style={{ display: "grid" }}>
                    <strong>{m.title}</strong>
                    <small className="cd-muted">{m.description ? `${m.description} · ` : ""}{m.type.toLowerCase()} · {fmtDate(m.createdAt)}</small>
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <a className="ds-btn tonal sm" href={`/api/files/${m.file!.id}`} target="_blank" rel="noreferrer">Open</a>
                    <a className="ds-btn outline sm" href={`/api/files/${m.file!.id}?dl=1`}>Download</a>
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        ))
      )}
    </PageWrap>
  );
}
