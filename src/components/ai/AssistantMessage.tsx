"use client";

import { useState } from "react";
import { splitFrames, type Block } from "@/lib/ai/blocks";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { BlockView } from "./Blocks";
import { Markdown } from "./Markdown";

type Step = Extract<Block, { type: "step" }>;

/** Live progress while Nova works: one row per step, a spinner on the running one and a tick when it is done. */
function Thinking({ steps }: { steps: Step[] }) {
  const rows: Step[] = [];
  for (const s of steps) {
    const i = rows.findIndex((r) => r.label === s.label);
    if (i >= 0) rows[i] = { ...rows[i], done: s.done ?? rows[i].done };
    else rows.push({ ...s });
  }
  // Agent rows finish only when they report back (they run side by side); plain phase rows finish once a later row appears.
  const view = rows.map((r, i) => ({ ...r, done: r.done || (!r.agent && i < rows.length - 1) }));
  const running = view.filter((r) => r.agent && !r.done).length;
  return (
    <div className="ai-think" role="status" aria-live="polite">
      <div className="ai-think-head"><span className="ai-dots" aria-hidden="true"><i /><i /><i /></span> {running > 1 ? `${running} agents working together` : "Nova is working"}</div>
      <ol>
        {view.map((r) => (
          <li key={r.label} data-done={r.done ? "1" : "0"}>
            <span className="ai-step-ic" aria-hidden="true">{r.done ? <Icon name="check" size={12} /> : <span className="ai-spin" />}</span>
            <span>{r.agent && <b className="ai-agent">{r.agent}</b>}{r.label}{r.done ? "" : "…"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReportCard({ title, markdown, blocks }: { title: string; markdown: string; blocks: Block[] }) {
  const [busy, setBusy] = useState(false);
  const sections = (markdown.match(/^#{1,4}\s/gm) ?? []).length;
  const download = async () => {
    setBusy(true);
    try {
      const { exportReplyPdf } = await import("@/lib/ai/export-pdf");
      await exportReplyPdf(markdown, "Prepared by Nova", title, blocks);
    } catch {
      toast.error("Could not create the PDF.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ai-report">
      <span className="ai-report-ic" aria-hidden="true">PDF</span>
      <div className="ai-report-txt"><strong>{title}</strong><small>{sections ? `${sections} section${sections === 1 ? "" : "s"} · ` : ""}{blocks.length ? `${blocks.length} visual${blocks.length === 1 ? "" : "s"} · ` : ""}ready to download</small></div>
      <button type="button" className="ds-btn sm" onClick={download} disabled={busy}><Icon name="download" size={14} /> {busy ? "Preparing…" : "Download"}</button>
    </div>
  );
}

/** One assistant reply: progress while working, then visuals, then the text. `content` may still contain streaming frames. */
export function AssistantMessage({ content, blocks, pending, onSend, active }: { content: string; blocks?: Block[]; pending?: boolean; onSend?: (text: string) => void; active?: boolean }) {
  const parsed = splitFrames(content);
  const all = [...(blocks ?? []), ...parsed.blocks];
  const steps = all.filter((b): b is Step => b.type === "step");
  const shown = all.filter((b) => b.type !== "step");
  const working = pending && !parsed.text;
  return (
    <div className="ai-reply">
      {working && (steps.length ? <Thinking steps={steps} /> : <div className="ai-think"><div className="ai-think-head"><span className="ai-dots" aria-hidden="true"><i /><i /><i /></span> Nova is thinking</div></div>)}
      {shown.map((b, i) => (b.type === "report" ? <ReportCard key={i} title={b.title} markdown={b.markdown} blocks={shown.filter((x) => x.type !== "report")} /> : <BlockView key={i} block={b} ctx={{ onSend, active: !!active && !pending }} />))}
      {parsed.text ? <div className="cp-msg" data-role="ASSISTANT"><Markdown text={parsed.text} /></div> : null}
    </div>
  );
}
