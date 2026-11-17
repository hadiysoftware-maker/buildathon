import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";
import { Review } from "@/features/flashcards/Review";

export const metadata = { title: "Flashcards · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const rows = await prisma.flashcard.findMany({ where: { userId: s.userId }, orderBy: [{ topic: "asc" }, { createdAt: "asc" }], take: 400 });
  const now = new Date();
  const cards = rows.map((c) => ({ id: c.id, topic: c.topic, front: c.front, back: c.back, box: c.box, due: c.dueAt <= now }));
  return (
    <PageWrap>
      <PageHeader eyebrow="Learning" title="Flashcards" description="Short revision cards. Cards you know come back less often; cards you miss come back tomorrow." />
      <SectionCard title="Today's review" icon="read" count={cards.filter((c) => c.due).length}>
        <Review cards={cards} />
      </SectionCard>
    </PageWrap>
  );
}
