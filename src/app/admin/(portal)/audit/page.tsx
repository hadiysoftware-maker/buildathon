import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap, PillChip, SectionCard } from "@/components/dashboard/Kit";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Audit & logins · EduCore" };

const words = (s: string) => s.toLowerCase().replace(/_/g, " ");

export default async function Page() {
  const s = await requirePagePermission("audit.view");
  const inst = { institutionId: s.institutionId };
  const [logins, audits] = await Promise.all([
    prisma.authenticationLog.findMany({ where: inst, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { fullName: true } } } }),
    prisma.auditLog.findMany({ where: inst, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const actors = await prisma.user.findMany({ where: { id: { in: [...new Set(audits.map((a) => a.actorId).filter((x): x is string => !!x))] } }, select: { id: true, fullName: true } });
  const actorName = new Map(actors.map((a) => [a.id, a.fullName]));

  return (
    <PageWrap>
      <PageHeader eyebrow="Security" title="Audit & logins" description="The last 100 sign-in attempts and administrative actions. Records cannot be edited." />
      <SectionCard title="Sign-in attempts" icon="shieldCheck">
        {logins.length === 0 ? <p className="cd-muted">No sign-in attempts yet.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Sign-in attempts">
              <thead><tr><th>When</th><th>Person</th><th>Result</th><th>Method</th><th>IP</th></tr></thead>
              <tbody>
                {logins.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.createdAt)}</td>
                    <td>{r.user?.fullName ?? <span className="cd-muted">Unknown</span>}</td>
                    <td><PillChip tone={r.result === "SUCCESS" ? "ok" : "bad"}>{words(r.result)}</PillChip></td>
                    <td>{words(r.method)}{r.portal ? ` · ${r.portal}` : ""}</td>
                    <td>{r.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <SectionCard title="Administrative actions" icon="clipboard">
        {audits.length === 0 ? <p className="cd-muted">No actions recorded yet.</p> : (
          <div className="dk-table-wrap">
            <table className="dk-table" aria-label="Administrative actions">
              <thead><tr><th>When</th><th>By</th><th>Action</th><th>Target</th></tr></thead>
              <tbody>
                {audits.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.createdAt)}</td>
                    <td>{r.actorId ? actorName.get(r.actorId) ?? r.actorId : "System"}</td>
                    <td><code>{r.action}</code></td>
                    <td>{r.entityType}</td>
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
