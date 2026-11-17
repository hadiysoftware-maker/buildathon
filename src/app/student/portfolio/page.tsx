import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { PageHeader, PageWrap } from "@/components/dashboard/Kit";
import { StatGrid } from "@/components/dashboard/StatGrid";
import { PortfolioView } from "@/features/portfolio/PortfolioView";

export const metadata = { title: "Portfolio · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const st = await prisma.studentProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
  const p = st ? await prisma.studentPortfolio.findUnique({ where: { studentId: st.id }, include: { entries: { orderBy: { occurredAt: "desc" }, take: 200 } } }) : null;
  const entries = p?.entries ?? [];
  return (
    <PageWrap>
      <PageHeader eyebrow="Learning" title="My portfolio" description="Your achievements, quiz results and graded work in one verified timeline." />
      <StatGrid items={[
        { icon: "award", label: "Entries", value: entries.length },
        { icon: "quiz", label: "Quizzes", value: entries.filter((e) => e.type === "QUIZ").length },
        { icon: "clipboard", label: "Assignments", value: entries.filter((e) => e.type === "ASSIGNMENT").length },
        { icon: "done", label: "Verified", value: entries.filter((e) => e.verified).length },
      ]} />
      <PortfolioView mode="own" headline={p?.headline ?? ""} entries={entries.map((e) => ({ id: e.id, type: e.type, title: e.title, summary: e.summary, verified: e.verified, manual: e.sourceType === "Manual", occurredAt: e.occurredAt.toISOString() }))} />
    </PageWrap>
  );
}
