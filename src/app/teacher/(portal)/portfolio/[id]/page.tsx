import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap } from "@/components/dashboard/Kit";
import { PortfolioView } from "@/features/portfolio/PortfolioView";

export const metadata = { title: "Student portfolio · EduCore" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePagePermission("portfolio.view.any", "/teacher/login");
  const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const st = t
    ? await prisma.studentProfile.findFirst({
        where: { id, institutionId: s.institutionId, enrollments: { some: { status: "ACTIVE", division: { teacherAssignments: { some: { teacherId: t.id } } } } } },
        select: { studentCode: true, user: { select: { fullName: true } }, portfolio: { include: { entries: { orderBy: { occurredAt: "desc" }, take: 200 } } } },
      })
    : null;
  if (!st) notFound();
  const entries = st.portfolio?.entries ?? [];
  return (
    <PageWrap>
      <PageHeader eyebrow={<Link href="/teacher/portfolio">← Portfolios</Link>} title={st.user.fullName} description={`${st.studentCode}${st.portfolio?.headline ? ` · ${st.portfolio.headline}` : ""}`} />
      <PortfolioView mode="teacher" headline="" entries={entries.map((e) => ({ id: e.id, type: e.type, title: e.title, summary: e.summary, verified: e.verified, manual: e.sourceType === "Manual", occurredAt: e.occurredAt.toISOString() }))} />
    </PageWrap>
  );
}
