import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { KvGrid, PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { DAY_NAMES } from "@/lib/format";
import { toMinutes } from "@/lib/timetable/schedule";

export const metadata = { title: "Period · EduCore" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePagePermission("academic.manage");
  const { id } = await params;
  const period = await prisma.period.findFirst({ where: { id, institutionId: s.institutionId } });
  if (!period) notFound();

  const year = await prisma.academicYear.findFirst({ where: { institutionId: s.institutionId, status: "ACTIVE" }, select: { id: true, name: true } });
  const entries = year
    ? await prisma.timetableEntry.findMany({
        where: { periodId: id, academicYearId: year.id, status: "ACTIVE" },
        orderBy: [{ dayOfWeek: "asc" }],
        include: { subject: { select: { name: true } }, teacher: { include: { user: { select: { fullName: true } } } }, classroom: { select: { name: true } }, division: { include: { class: { select: { name: true } } } } },
      })
    : [];
  const minutes = toMinutes(period.endTime) - toMinutes(period.startTime);
  const byDay = new Map<number, typeof entries>();
  for (const e of entries) byDay.set(e.dayOfWeek, [...(byDay.get(e.dayOfWeek) ?? []), e]);

  return (
    <PageWrap>
      <PageHeader
        eyebrow={<Link href="/admin/academic/periods">← Periods</Link>}
        title={period.name}
        description={`${period.startTime}–${period.endTime}${period.archivedAt ? " · archived" : ""}`}
      />
      <KvGrid items={[
        { label: "Order", value: `#${period.sequence}` },
        { label: "Starts", value: period.startTime },
        { label: "Ends", value: period.endTime },
        { label: "Length", value: `${minutes} min` },
        { label: "Type", value: <PillChip tone={period.kind === "CLASS" ? "brand" : "warn"}>{period.kind.toLowerCase()}</PillChip> },
        { label: "Lessons scheduled", value: period.kind === "CLASS" ? entries.length : "—" },
      ]} />

      <SectionCard title="What runs in this period" icon="calendar" subtitle={year ? `Active year ${year.name}` : undefined}>
        {period.kind !== "CLASS" ? (
          <p className="cd-muted">This is a {period.kind.toLowerCase()} slot, so no classes are scheduled in it.</p>
        ) : !year ? (
          <p className="cd-muted">Activate an academic year to see its timetable.</p>
        ) : entries.length === 0 ? (
          <p className="cd-muted">Nothing is scheduled in this period yet. Use the timetable builder.</p>
        ) : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Lessons in this period">
              <thead><tr><th>Day</th><th>Class</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead>
              <tbody>
                {[...byDay.entries()].flatMap(([day, list]) =>
                  list.map((e, i) => (
                    <tr key={e.id}>
                      <td>{i === 0 ? <strong>{DAY_NAMES[day]}</strong> : ""}</td>
                      <td>{e.division.class.name} · {e.division.name}</td>
                      <td>{e.subject.name}</td>
                      <td>{e.teacher.user.fullName}</td>
                      <td>{e.classroom?.name ?? "—"}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageWrap>
  );
}
