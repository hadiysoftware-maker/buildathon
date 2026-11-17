import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap, SectionCard } from "@/components/dashboard/Kit";

export const metadata = { title: "Copilot usage · EduCore" };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function Page() {
  const s = await requirePagePermission("audit.view");
  const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const since = ago(14);
  const rows = await prisma.aIUsageRecord.findMany({ where: { institutionId: s.institutionId, createdAt: { gte: since } }, select: { userId: true, model: true, promptTokens: true, completionTokens: true, createdAt: true }, take: 20000 });
  const files = await prisma.auditLog.count({ where: { institutionId: s.institutionId, createdAt: { gte: since }, action: { startsWith: "copilot." } } });
  const byDay = new Map<string, { n: number; tokens: number }>();
  for (let i = 13; i >= 0; i--) byDay.set(day(ago(i)), { n: 0, tokens: 0 });
  const byUser = new Map<string, number>();
  let routed = 0;
  for (const r of rows) {
    const d = byDay.get(day(r.createdAt));
    const t = (r.promptTokens ?? 0) + (r.completionTokens ?? 0);
    if (d) { d.n += 1; d.tokens += t; }
    if (r.model === "router") routed += 1;
    if (r.userId) byUser.set(r.userId, (byUser.get(r.userId) ?? 0) + 1);
  }
  const top = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const names = await prisma.user.findMany({ where: { id: { in: top.map(([id]) => id) }, institutionId: s.institutionId }, select: { id: true, fullName: true } });
  const nameOf = new Map(names.map((n) => [n.id, n.fullName]));
  const tokens = rows.reduce((n, r) => n + (r.promptTokens ?? 0) + (r.completionTokens ?? 0), 0);
  const max = Math.max(1, ...[...byDay.values()].map((d) => d.n));
  return (
    <PageWrap>
      <PageHeader eyebrow="Insights" title="Copilot usage" description="Last 14 days. Questions answered without the AI model (instant lookups) use no tokens." />
      <div className="ds-stats">
        <div className="ds-stat"><strong>{rows.length}</strong><span>Questions</span></div>
        <div className="ds-stat"><strong>{routed}</strong><span>Instant lookups</span></div>
        <div className="ds-stat"><strong>{tokens.toLocaleString("en-IN")}</strong><span>Tokens used</span></div>
        <div className="ds-stat"><strong>{files}</strong><span>Actions and files</span></div>
      </div>
      <SectionCard title="Questions per day" icon="chart">
        <ul className="us-bars" aria-label="Questions per day">
          {[...byDay.entries()].map(([d, v]) => (
            <li key={d}><span>{d.slice(5)}</span><i style={{ width: `${(v.n / max) * 100}%` }} /><b>{v.n}</b></li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard title="Most active" icon="users">
        {top.length === 0 ? <p className="cd-muted">No usage yet.</p> : (
          <ul className="us-top">{top.map(([id, n]) => <li key={id}><span>{nameOf.get(id) ?? "Unknown"}</span><b>{n}</b></li>)}</ul>
        )}
      </SectionCard>
    </PageWrap>
  );
}
