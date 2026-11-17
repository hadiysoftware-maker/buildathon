/** Instant placeholder shown while a portal page streams in. Server component, no JS. */
export function PageSkeleton() {
  return (
    <div className="cd-page" role="status" aria-label="Loading page">
      <div className="ds-skeleton" style={{ height: 26, width: "min(280px, 60%)", borderRadius: 10 }} />
      <div className="ds-skeleton" style={{ height: 14, width: "min(420px, 85%)", borderRadius: 8 }} />
      <div className="cd-grid" style={{ marginTop: 6 }}>
        {[0, 1, 2].map((i) => <div key={i} className="ds-skeleton" style={{ height: 92 }} />)}
      </div>
      <div className="dk-skel"><span /><span /><span /><span /></div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
