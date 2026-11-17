"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { saveFlashcards } from "@/features/flashcards/actions";
import type { Block } from "@/lib/ai/blocks";
import "./agentic.css";

type Of<T extends Block["type"]> = Extract<Block, { type: T }>;
export interface AgentCtx { onSend?: (text: string) => void; active?: boolean }

/** Plan card: a vertical stepper the user approves before anything runs. */
export function PlanCard({ block, ctx }: { block: Of<"plan">; ctx: AgentCtx }) {
  const [state, setState] = useState<"ask" | "approved" | "edit">("ask");
  const [note, setNote] = useState("");
  const live = !!ctx.active && !!ctx.onSend && state !== "approved";
  const approve = () => { setState("approved"); ctx.onSend?.(`Approved. Go ahead with the plan: ${block.title}. Steps: ${block.steps.map((s, i) => `${i + 1}) ${s.label}`).join("; ")}. Do it now with sensible defaults and realistic sample data where details are missing; do not ask me anything else.`); };
  const change = () => { if (!note.trim()) return; setState("approved"); ctx.onSend?.(`Change the plan: ${note.trim()}`); };
  return (
    <section className="ag-plan" aria-label={`Plan: ${block.title}`} data-state={state}>
      <header><span className="ag-tag">{state === "approved" ? "Approved" : "Plan"}</span><h4>{block.title}</h4></header>
      <ol>
        {block.steps.map((s, i) => (
          <li key={i}><i aria-hidden="true">{state === "approved" ? <Icon name="check" size={11} /> : i + 1}</i><span>{s.label}{s.agent ? <small> · {s.agent}</small> : null}</span></li>
        ))}
      </ol>
      {block.note && <p className="ag-note">{block.note}</p>}
      {live && state === "ask" && (
        <footer>
          <button type="button" className="ag-go" onClick={approve}>Approve and run</button>
          <button type="button" className="ag-ghost" onClick={() => setState("edit")}>Change something</button>
        </footer>
      )}
      {live && state === "edit" && (
        <footer>
          <input aria-label="What should change in the plan?" autoFocus placeholder="What should change?" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && change()} />
          <button type="button" className="ag-go" disabled={!note.trim()} onClick={change}>Update plan</button>
        </footer>
      )}
    </section>
  );
}

/** Question card: tappable answers (or a short text box) sent back as one message. */
export function AskCard({ block, ctx }: { block: Of<"ask">; ctx: AgentCtx }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const live = !!ctx.active && !!ctx.onSend && !sent;
  const set = (k: string, v: string) => setVals((x) => ({ ...x, [k]: v }));
  const ready = block.questions.some((q) => vals[q.key]?.trim());
  const send = (skip = false) => {
    setSent(true);
    ctx.onSend?.(skip ? "Skip the questions and use your best judgement." : block.questions.filter((q) => vals[q.key]?.trim()).map((q) => `${q.label} ${vals[q.key].trim()}`).join("\n"));
  };
  return (
    <section className="ag-ask" aria-label={block.title} data-sent={sent ? "1" : "0"}>
      <header><span className="ag-tag">{sent ? "Answered" : "Quick questions"}</span><h4>{block.title}</h4></header>
      {block.questions.map((q) => (
        <div key={q.key} className="ag-q">
          <label>{q.label}</label>
          {q.options?.length ? (
            <div className="ag-opts" role="group" aria-label={q.label}>
              {q.options.map((o) => <button key={o} type="button" disabled={!live} data-on={vals[q.key] === o ? "1" : "0"} onClick={() => set(q.key, o)}>{o}</button>)}
            </div>
          ) : null}
          <input aria-label={q.label} disabled={!live} placeholder={q.options?.length ? "Or type your own" : q.placeholder ?? "Type here"} value={q.options?.includes(vals[q.key] ?? "") ? "" : vals[q.key] ?? ""} onChange={(e) => set(q.key, e.target.value)} />
        </div>
      ))}
      {live && (
        <footer>
          <button type="button" className="ag-go" disabled={!ready} onClick={() => send()}>Continue</button>
          <button type="button" className="ag-ghost" onClick={() => send(true)}>Skip, you decide</button>
        </footer>
      )}
    </section>
  );
}

/** Action card: a proposed change that only happens when the user presses Confirm. */
export function ActionCard({ block, ctx }: { block: Of<"action">; ctx: AgentCtx }) {
  const [st, setSt] = useState<"idle" | "busy" | "done" | "dismissed" | "error">("idle");
  const [res, setRes] = useState<{ message: string; link?: { label: string; href: string } } | null>(null);
  const confirm = async () => {
    setSt("busy");
    try {
      const r = await fetch("/api/ai/act", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: block.token }) });
      const j = (await r.json().catch(() => ({}))) as { message?: string; link?: { label: string; href: string }; error?: string };
      if (!r.ok) { toast.error(j.error ?? "Could not do that."); setSt("error"); return; }
      setRes({ message: j.message ?? "Done.", link: j.link });
      setSt("done");
    } catch {
      toast.error("Network error. Try again."); setSt("error");
    }
  };
  if (st === "done" && res) {
    return (
      <div className="ag-done" role="status"><Icon name="done" size={18} /><span><strong>{res.message}</strong>{res.link && <> <a href={res.link.href}>{res.link.label} →</a></>}</span></div>
    );
  }
  if (st === "dismissed") return <div className="ag-done" data-muted="1"><span>Cancelled. Nothing was changed.</span></div>;
  const live = ctx.active !== false;
  return (
    <section className="ag-act" aria-label={block.title}>
      <header><span className="ag-tag warn">Needs your OK</span><h4>{block.title}</h4></header>
      <ul>{block.summary.map((l, i) => <li key={i}><b aria-hidden="true">+</b>{l}</li>)}</ul>
      {live ? (
        <footer>
          <button type="button" className="ag-go" disabled={st === "busy"} onClick={confirm}>{st === "busy" ? "Working…" : block.confirm}</button>
          <button type="button" className="ag-ghost" disabled={st === "busy"} onClick={() => setSt("dismissed")}>Cancel</button>
        </footer>
      ) : <small className="ag-note">This request is no longer active.</small>}
    </section>
  );
}

const KIND = { pptx: { letter: "P", label: "PowerPoint" }, docx: { letter: "W", label: "Word" }, xlsx: { letter: "X", label: "Excel" } } as const;

/** File card: one compact row with a coloured type glyph and a download button. */
export function FileCard({ block }: { block: Of<"file"> }) {
  const k = KIND[block.kind];
  const size = block.size > 1048576 ? `${(block.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(block.size / 1024))} KB`;
  return (
    <div className="ag-file" data-kind={block.kind}>
      <span className="ag-glyph" aria-hidden="true">{k.letter}</span>
      <span className="ag-file-main"><strong title={block.name}>{block.name}</strong><small>{k.label} · {size}{block.detail ? ` · ${block.detail}` : ""}</small></span>
      <a className="ag-dl" href={`/api/files/${block.fileId}?dl=1`} aria-label={`Download ${block.name}`}><Icon name="download" size={15} /> Download</a>
    </div>
  );
}

/** Photo strip with credits. */
export function ImageStrip({ block }: { block: Of<"images"> }) {
  return (
    <div className="ag-imgs" role="list" aria-label="Photos found online">
      {block.items.map((i) => (
        <a key={i.url} role="listitem" href={i.pageUrl} target="_blank" rel="noreferrer noopener" title={i.credit}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={i.thumb} alt={i.alt} loading="lazy" referrerPolicy="no-referrer" />
          <small>{i.credit.replace("Photo by ", "")}</small>
        </a>
      ))}
    </div>
  );
}

/** Animated slide viewer: the same transitions and entrance effects the .pptx carries. */
export function DeckPreview({ block }: { block: Of<"deck"> }) {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  const n = block.slides.length;
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 3800);
    return () => clearInterval(t);
  }, [play, n]);
  const s = block.slides[i];
  const hero = ["title", "section", "closing"].includes(s.layout);
  const fx = s.animation && s.animation !== "none" ? s.animation : "";
  const style = { "--p": `#${block.theme.primary}`, "--a": `#${block.theme.accent}` } as React.CSSProperties;
  let d = 0;
  const step = () => ({ "--d": `${(d++) * 0.18}s` }) as React.CSSProperties;
  const list = (items?: string[]) => <ul>{(items ?? []).map((t, k) => <li key={k} style={step()}>{t}</li>)}</ul>;
  return (
    <section className="ag-deck" style={style} data-dark={block.theme.dark ? "1" : "0"} aria-label={`Slide preview: ${block.title}`}
      tabIndex={0} onKeyDown={(e) => { if (e.key === "ArrowRight") setI((x) => Math.min(n - 1, x + 1)); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); }}>
      <div className="ag-stage" data-hero={hero ? "1" : "0"}>
        <div key={i} className="ag-slide" data-fx={fx} data-layout={s.layout}>
          <h5 style={step()}>{s.title}</h5>
          {s.subtitle && <p className="ag-sub" style={step()}>{s.subtitle}</p>}
          {s.layout === "two-column" ? <div className="ag-cols">{list(s.left)}{list(s.right)}</div>
            : s.layout === "quote" ? <blockquote style={step()}>{s.quote ?? s.title}{s.author ? <cite>{s.author}</cite> : null}</blockquote>
            : s.layout === "chart" ? <p className="ag-sub" style={step()}>Chart slide (editable in PowerPoint)</p>
            : s.bullets?.length ? list(s.bullets) : null}
          {s.imageUrl && /^https:\/\/images\.(pexels|unsplash)\.com\//.test(s.imageUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ag-pic" src={s.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" style={step()} />
          )}
        </div>
      </div>
      <footer>
        <button type="button" aria-label="Previous slide" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="back" size={15} /></button>
        <span className="ag-dots" aria-hidden="true">{block.slides.map((_, k) => <i key={k} data-on={k === i ? "1" : "0"} />)}</span>
        <button type="button" aria-label="Next slide" disabled={i === n - 1} onClick={() => setI(i + 1)}><Icon name="back" size={15} style={{ transform: "rotate(180deg)" }} /></button>
        <button type="button" className="ag-play" onClick={() => setPlay((p) => !p)} aria-pressed={play}>{play ? "Pause" : "Play"}</button>
        <small>{i + 1} / {n}</small>
      </footer>
    </section>
  );
}

/** Flip-through revision cards with one button to keep them in the student's deck. */
export function FlashDeck({ block }: { block: Of<"flashcards"> }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [saved, setSaved] = useState<"no" | "busy" | "yes">("no");
  const n = block.cards.length;
  const c = block.cards[i];
  const save = async () => {
    setSaved("busy");
    const r = await saveFlashcards({ topic: block.topic, cards: block.cards });
    if (!r.ok) { toast.error(r.error); setSaved("no"); return; }
    setSaved("yes");
    toast.success(r.data?.added ? `${r.data.added} cards saved to your deck` : "Already in your deck");
  };
  return (
    <section className="ag-flash" aria-label={`Flashcards: ${block.topic}`}>
      <header><span className="ag-tag">Flashcards</span><h4>{block.topic}</h4></header>
      <button type="button" className="ag-fcard" data-flip={flip ? "1" : "0"} onClick={() => setFlip((f) => !f)} aria-label={flip ? "Answer. Tap to see the question" : "Question. Tap to show the answer"}>
        <span>{flip ? c.back : c.front}</span><small>{flip ? "Answer" : "Tap to flip"}</small>
      </button>
      <footer>
        <button type="button" className="ag-ghost" disabled={i === 0} onClick={() => { setI(i - 1); setFlip(false); }}>Back</button>
        <small>{i + 1} / {n}</small>
        <button type="button" className="ag-ghost" disabled={i === n - 1} onClick={() => { setI(i + 1); setFlip(false); }}>Next</button>
        <button type="button" className="ag-go" disabled={saved !== "no"} onClick={save}>{saved === "yes" ? "Saved" : saved === "busy" ? "Saving…" : "Save to my deck"}</button>
      </footer>
    </section>
  );
}

/** Research approval: the user decides before Nova reads anything outside the school. */
export function ResearchCard({ block, ctx }: { block: Of<"research">; ctx: AgentCtx }) {
  const [state, setState] = useState<"ask" | "approved" | "declined">("ask");
  const live = !!ctx.active && !!ctx.onSend && state === "ask";
  const go = () => { setState("approved"); ctx.onSend?.(`Approved research: ${block.question}${block.urls.length ? ` Pages to read: ${block.urls.join(" ")}` : ""}. Write the actual explanation from what the sources say, with citations; do not just list the sources.`); };
  return (
    <section className="ag-research" aria-label="Research approval" data-state={state}>
      <header><span className="ag-tag">{state === "approved" ? "Approved" : state === "declined" ? "Skipped" : "Needs your approval"}</span><h4>Look this up online?</h4></header>
      <p className="ag-rq">“{block.question}”</p>
      <p className="ag-note">Nova will search {block.sites}. Only these search words{block.urls.length ? " and the pages below" : ""} leave the school; no student or personal data is sent. Sources will be shown with every answer.</p>
      {block.urls.length > 0 && <ul className="ag-ru">{block.urls.map((u) => <li key={u}>{u.replace(/^https:\/\//, "")}</li>)}</ul>}
      {live && (
        <footer>
          <button type="button" className="ag-go" onClick={go}>Approve and search</button>
          <button type="button" className="ag-ghost" onClick={() => { setState("declined"); ctx.onSend?.("No online research. Answer from what you know and say that it is not from a source."); }}>No, answer without</button>
        </footer>
      )}
    </section>
  );
}

/** Numbered sources behind a researched answer. */
export function SourcesCard({ block }: { block: Of<"sources"> }) {
  return (
    <section className="ag-src" aria-label="Sources">
      <header><span className="ag-tag">Sources</span><small>{block.items.length} found online</small></header>
      <ol>
        {block.items.map((s) => (
          <li key={s.url}>
            <b aria-hidden="true">{s.n}</b>
            <div>
              <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
              <small>{s.site}</small>
              <p>{s.text.slice(0, 160)}{s.text.length > 160 ? "…" : ""}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
