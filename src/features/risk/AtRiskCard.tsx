import Link from "next/link";
import { SectionCard } from "@/components/dashboard/Kit";
import { atRiskStudents } from "./risk";

/** Students flagged by the rules (low attendance, falling quizzes, overdue work). Shows nothing when nobody is flagged. */
export async function AtRiskCard({ institutionId, divisionIds, hrefBase }: { institutionId: string; divisionIds?: string[]; hrefBase: string }) {
  const rows = await atRiskStudents(institutionId, divisionIds, 6);
  if (!rows.length) return null;
  return (
    <SectionCard title="Students who may need support" icon="shieldCheck" count={rows.length}>
      <ul className="ar">
        {rows.map((r) => (
          <li key={r.studentId} data-level={r.level}>
            <Link href={`${hrefBase}/${hrefBase.startsWith("/admin") ? r.userId : r.studentId}`}><b>{r.name}</b></Link>
            <small>{r.cls} · {r.reasons.join(" · ")}</small>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
