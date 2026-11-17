import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface StatItem {
  icon: IconName;
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
}

/** Server-renderable stat tiles (OverviewKit.StatTiles takes component props, which a Server Component cannot pass). */
export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="ds-stats">
      {items.map((t) => {
        const body = (
          <>
            <div className="ds-stat-icon"><Icon name={t.icon} size={20} /></div>
            <strong>{t.value}</strong>
            <span>{t.label}</span>
            {t.sub && <small>{t.sub}</small>}
          </>
        );
        return t.href ? <Link key={t.label} href={t.href} className="ds-stat">{body}</Link> : <div key={t.label} className="ds-stat">{body}</div>;
      })}
    </div>
  );
}

/** Honest placeholder for a module scheduled for a later phase: visible, clearly labelled, not interactive. */
export function ComingSoon({ items }: { items: { icon: IconName; label: string; text: string; phase: number }[] }) {
  return (
    <div className="ds-grid ds-grid-3">
      {items.map((i) => (
        <div key={i.label} className="ds-mini ds-quick" aria-disabled="true" style={{ opacity: 0.65 }}>
          <span className="ds-tile"><Icon name={i.icon} size={20} /></span>
          <div className="ds-grow">
            <h3>{i.label}</h3>
            <p>{i.text} <em>Coming in phase {i.phase}.</em></p>
          </div>
        </div>
      ))}
    </div>
  );
}
