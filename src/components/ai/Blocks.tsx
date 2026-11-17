import Link from "next/link";
import { percents, type Block } from "@/lib/ai/blocks";
import { Quiz } from "./Quiz";
import { ActionCard, AskCard, FlashDeck, DeckPreview, FileCard, ImageStrip, PlanCard, ResearchCard, SourcesCard, type AgentCtx } from "./Agentic";

/** Renderers for Copilot visuals. Plain SVG and CSS: no chart library, light theme only. */
const COLORS = ["#0F766E", "#F5B83D", "#14A394", "#E07A8B", "#6C8EAD", "#9AA9A6"];
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const chip = (status: string) => (status === "ACTIVE" ? "ok" : status === "SUSPENDED" ? "warn" : "bad");

function Donut({ title, slices }: { title: string; slices: { label: string; value: number }[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const pct = percents(slices.map((s) => s.value));
  const R = 42;
  const C = 2 * Math.PI * R;
  const lens = slices.map((x) => (x.value / (total || 1)) * C);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <figure className="ai-card ai-donut" aria-label={`${title}: ${slices.map((s, i) => `${s.label} ${s.value}`).join(", ")}`}>
      <figcaption>{title}</figcaption>
      <div className="ai-donut-body">
        <svg viewBox="0 0 100 100" width="132" height="132" role="img" aria-hidden="true">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#E8F3F1" strokeWidth="14" />
          {slices.map((s, i) => {
            const len = lens[i];
            return <circle key={s.label} cx="50" cy="50" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="14" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-starts[i]} transform="rotate(-90 50 50)" />;
          })}
          <text x="50" y="49" textAnchor="middle" fontSize="17" fontWeight="700" fill="#0B2A2C">{total}</text>
          <text x="50" y="62" textAnchor="middle" fontSize="7.5" fill="#4B6B6D">total</text>
        </svg>
        <ul className="ai-legend">
          {slices.map((s, i) => (
            <li key={s.label}><i style={{ background: COLORS[i % COLORS.length] }} /> <span>{s.label}</span> <b>{s.value}</b> <small>{pct[i]}%</small></li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

function Bars({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="ai-card" aria-label={`${title}: ${rows.map((r) => `${r.label} ${r.value}`).join(", ")}`}>
      <figcaption>{title}</figcaption>
      <div className="ai-bars">
        {rows.map((r) => (
          <div key={r.label} className="ai-bar-row">
            <span className="ai-bar-label">{r.label}</span>
            <span className="ai-bar-track"><span className="ai-bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <b>{r.value}</b>
          </div>
        ))}
      </div>
    </figure>
  );
}

function Stats({ items }: { items: { label: string; value: number | string }[] }) {
  return (
    <div className="ai-stats">
      {items.map((s, i) => (
        <div key={s.label} className="ai-stat" data-tone={i % 4}>
          <b>{s.value}</b>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function StudentCards({ items }: { items: Extract<Block, { type: "students" }>["items"] }) {
  return (
    <div className="ai-people">
      {items.map((p) => {
        const body = (
          <>
            <span className="ai-avatar" aria-hidden="true">{initials(p.name)}</span>
            <span className="ai-person-main">
              <strong>{p.name}</strong>
              <small>Student · {p.code}</small>
              <span className="ai-person-meta">{p.cls}</span>
            </span>
            <span className="ai-chip" data-tone={chip(p.status)}>{p.status.toLowerCase()}</span>
          </>
        );
        return p.href ? <Link key={p.code + p.name} href={p.href} className="ai-person ai-student">{body}</Link> : <div key={p.code + p.name} className="ai-person ai-student">{body}</div>;
      })}
    </div>
  );
}

function TeacherCards({ items }: { items: Extract<Block, { type: "teachers" }>["items"] }) {
  return (
    <div className="ai-people">
      {items.map((t) => (
        <div key={t.code} className="ai-teacher">
          <div className="ai-teacher-head">
            <span className="ai-avatar sq" aria-hidden="true">{initials(t.name)}</span>
            <span className="ai-person-main">
              <strong>{t.name}</strong>
              <small>{t.role ?? "Teacher"} · {t.code}</small>
            </span>
            <span className="ai-chip" data-tone={chip(t.status)}>{t.status.toLowerCase()}</span>
          </div>
          <div className="ai-teacher-foot">
            <span className="ai-subjects">{t.subjects.length ? t.subjects.map((s) => <em key={s}>{s}</em>) : <em>No subjects yet</em>}</span>
            <span className="ai-count"><b>{t.classes}</b> {t.classes === 1 ? "class" : "classes"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline({ date, rows }: { date: string; rows: Extract<Block, { type: "timeline" }>["rows"] }) {
  return (
    <figure className="ai-card" aria-label={`Timetable for ${date}`}>
      <figcaption>{date}</figcaption>
      <ol className="ai-timeline">
        {rows.map((r, i) => (
          <li key={i} data-state={r.state}>
            <time>{r.time}</time>
            <span className="ai-dot" aria-hidden="true" />
            <span className="ai-tl-main"><strong>{r.title}</strong>{r.sub && <small>{r.sub}</small>}</span>
            {r.state === "current" && <span className="ai-chip" data-tone="ok">now</span>}
            {r.state === "cancelled" && <span className="ai-chip" data-tone="bad">cancelled</span>}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Materials({ items }: { items: Extract<Block, { type: "materials" }>["items"] }) {
  return (
    <div className="ai-people">
      {items.map((m, i) => {
        const body = (
          <>
            <span className="ai-file" aria-hidden="true">{m.kind.slice(0, 4)}</span>
            <span className="ai-person-main"><strong>{m.title}</strong><small>{m.subject} · {m.size}</small></span>
            {m.status !== "PUBLISHED" && <span className="ai-chip" data-tone="warn">{m.status.toLowerCase()}</span>}
          </>
        );
        return m.href ? <a key={i} href={m.href} target="_blank" rel="noopener noreferrer" className="ai-person" aria-label={`Open ${m.title}`}>{body}</a> : <div key={i} className="ai-person">{body}</div>;
      })}
    </div>
  );
}

function PageLinks({ items }: { items: Extract<Block, { type: "links" }>["items"] }) {
  return (
    <div className="ai-people">
      {items.map((l) => (
        <Link key={l.href} href={l.href} className="ai-person" aria-label={`Open ${l.label}`}>
          <span className="ai-file" aria-hidden="true">GO</span>
          <span className="ai-person-main"><strong>{l.label}</strong>{l.hint && <small>{l.hint}</small>}</span>
        </Link>
      ))}
    </div>
  );
}

function Summary({ title, points, next }: { title: string; points: string[]; next?: string }) {
  return (
    <section className="ai-summary" aria-label={title}>
      <h4>{title}</h4>
      <ul>{points.map((p, i) => <li key={i}>{p}</li>)}</ul>
      {next && <p className="ai-next"><b>Next:</b> {next}</p>}
    </section>
  );
}

export function BlockView({ block, ctx = {} }: { block: Block; ctx?: AgentCtx }) {
  switch (block.type) {
    case "stats": return <Stats items={block.items} />;
    case "donut": return <Donut title={block.title} slices={block.slices} />;
    case "bar": return <Bars title={block.title} rows={block.rows} />;
    case "students": return <StudentCards items={block.items} />;
    case "teachers": return <TeacherCards items={block.items} />;
    case "timeline": return <Timeline date={block.date} rows={block.rows} />;
    case "materials": return <Materials items={block.items} />;
    case "links": return <PageLinks items={block.items} />;
    case "quiz": return <Quiz title={block.title} questions={block.questions} />;
    case "summary": return <Summary title={block.title} points={block.points} next={block.next} />;
    case "plan": return <PlanCard block={block} ctx={ctx} />;
    case "flashcards": return <FlashDeck block={block} />;
    case "ask": return <AskCard block={block} ctx={ctx} />;
    case "action": return <ActionCard block={block} ctx={ctx} />;
    case "file": return <FileCard block={block} />;
    case "deck": return <DeckPreview block={block} />;
    case "research": return <ResearchCard block={block} ctx={ctx} />;
    case "sources": return <SourcesCard block={block} />;
    case "images": return <ImageStrip block={block} />;
    default: return null;
  }
}
