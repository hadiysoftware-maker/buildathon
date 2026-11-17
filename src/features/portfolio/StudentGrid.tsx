"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface StudentCardRow { id: string; name: string; code: string; cls: string; entries: number }

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

/** Searchable, class-filtered grid of student cards. */
export function StudentGrid({ rows, hrefBase }: { rows: StudentCardRow[]; hrefBase: string }) {
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("all");
  const classes = useMemo(() => [...new Set(rows.map((r) => r.cls))].sort(), [rows]);
  const shown = rows.filter((r) => (cls === "all" || r.cls === cls) && (!q.trim() || `${r.name} ${r.code}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="sg">
      <div className="sg-bar">
        <input type="search" aria-label="Search students" placeholder="Search by name or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="sg-chips" role="group" aria-label="Filter by class">
          <button type="button" data-on={cls === "all" ? "1" : "0"} onClick={() => setCls("all")}>All</button>
          {classes.map((c) => <button key={c} type="button" data-on={cls === c ? "1" : "0"} onClick={() => setCls(c)}>{c}</button>)}
        </div>
      </div>
      {shown.length === 0 ? <p className="cd-muted">No students match.</p> : (
        <ul className="sg-grid">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`${hrefBase}/${r.id}`} className="sg-card">
                <span className="sg-av" aria-hidden="true" style={{ background: `hsl(${hue(r.name + r.code)} 45% 88%)`, color: `hsl(${hue(r.name + r.code)} 50% 25%)` }}>{initials(r.name)}</span>
                <span className="sg-main"><strong>{r.name}</strong><small>{r.cls} · ID {r.code}</small></span>
                <span className="sg-n" title="Portfolio entries">{r.entries}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
