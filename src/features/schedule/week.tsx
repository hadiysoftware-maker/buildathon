import "server-only";
import { prisma } from "@/lib/db";
import { PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { EmptyState } from "@/components/ui/EmptyState";
import { DAY_NAMES } from "@/lib/format";

/** Read-only weekly timetable for the signed-in student or teacher (base schedule, before per-day overrides). */
export async function WeekPage({ institutionId, userId, who }: { institutionId: string; userId: string; who: "student" | "teacher" }) {
  const year = await prisma.academicYear.findFirst({ where: { institutionId, status: "ACTIVE" }, select: { id: true } });
  const [periods, setting] = await Promise.all([
    prisma.period.findMany({ where: { institutionId, archivedAt: null }, orderBy: { sequence: "asc" } }),
    prisma.institutionSetting.findUnique({ where: { institutionId_key: { institutionId, key: "workingDays" } } }),
  ]);
  const days = Array.isArray(setting?.value) && (setting.value as unknown[]).every((n) => typeof n === "number") ? (setting.value as number[]) : [1, 2, 3, 4, 5];

  let where: { divisionId: string } | { teacherId: string } | null = null;
  if (year) {
    if (who === "student") {
      const e = await prisma.enrollment.findFirst({ where: { status: "ACTIVE", academicYearId: year.id, student: { userId } }, select: { divisionId: true } });
      if (e) where = { divisionId: e.divisionId };
    } else {
      const t = await prisma.teacherProfile.findUnique({ where: { userId }, select: { id: true } });
      if (t) where = { teacherId: t.id };
    }
  }
  const entries =
    year && where
      ? await prisma.timetableEntry.findMany({
          where: { academicYearId: year.id, status: "ACTIVE", ...where },
          include: { subject: { select: { name: true } }, teacher: { include: { user: { select: { fullName: true } } } }, classroom: { select: { name: true } }, division: { include: { class: { select: { name: true } } } } },
        })
      : [];

  return (
    <PageWrap>
      <PageHeader eyebrow={who === "student" ? "Learning" : "Teaching"} title="My timetable" description="Your weekly schedule. Cancellations and substitutions appear on the Today view." />
      <SectionCard title="This week" icon="calendar">
        {!year ? (
          <EmptyState title="No active academic year" hint="An administrator needs to activate an academic year." />
        ) : !where || entries.length === 0 ? (
          <EmptyState title="No timetable yet" hint={who === "student" ? "You may not be enrolled in a class yet, or no timetable has been built." : "No classes have been assigned to you yet."} />
        ) : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Weekly timetable">
              <thead><tr><th>Period</th>{days.map((d) => <th key={d}>{DAY_NAMES[d]}</th>)}</tr></thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong><br /><small className="cd-muted">{p.startTime}–{p.endTime}</small></td>
                    {p.kind !== "CLASS" ? (
                      <td colSpan={days.length} style={{ textAlign: "center" }} className="cd-muted">{p.kind === "LUNCH" ? "Lunch" : "Break"}</td>
                    ) : (
                      days.map((d) => {
                        const e = entries.find((x) => x.periodId === p.id && x.dayOfWeek === d);
                        return (
                          <td key={d}>
                            {e ? (
                              <span style={{ display: "grid", lineHeight: 1.25 }}>
                                <strong>{e.subject.name}</strong>
                                <small className="cd-muted">{who === "student" ? e.teacher.user.fullName : `${e.division.class.name} · ${e.division.name}`}{e.classroom ? ` · ${e.classroom.name}` : ""}</small>
                              </span>
                            ) : <span className="cd-muted">—</span>}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageWrap>
  );
}
