"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, PillChip, SectionCard, Sheet } from "@/components/dashboard/Kit";
import { M3Select } from "@/components/ui/M3Select";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { fmtDate } from "@/lib/format";
import { addPortfolioEntry, deletePortfolioEntry, updateHeadline, verifyPortfolioEntry } from "./actions";

export interface EntryRow { id: string; type: string; title: string; summary: string | null; verified: boolean; manual: boolean; occurredAt: string }

const TYPES = [
  { value: "ACHIEVEMENT", label: "Achievement" }, { value: "PROJECT", label: "Project" }, { value: "CERTIFICATE", label: "Certificate" },
  { value: "SKILL", label: "Skill" }, { value: "MILESTONE", label: "Milestone" },
];

export function PortfolioView({ headline, entries, mode }: { headline: string; entries: EntryRow[]; mode: "own" | "teacher" }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [head, setHead] = useState(headline);
  const [f, setF] = useState({ type: "ACHIEVEMENT", title: "", summary: "", occurredAt: new Date().toISOString().slice(0, 10) });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => { const r = await fn(); if (r.ok) { toast.success(ok); router.refresh(); } else toast.error(r.error ?? "Failed"); });
  const add = () =>
    start(async () => {
      const r = await addPortfolioEntry({ type: f.type as "ACHIEVEMENT", title: f.title, summary: f.summary, occurredAt: f.occurredAt });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Added"); setOpen(false); setF({ ...f, title: "", summary: "" }); router.refresh();
    });

  return (
    <>
      {mode === "own" && (
        <SectionCard title="Headline" icon="star">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input aria-label="Portfolio headline" style={{ flex: 1, minWidth: 220 }} value={head} maxLength={255} placeholder="One line about you, e.g. Curious about science and robotics" onChange={(e) => setHead(e.target.value)} />
            <button type="button" className="ds-btn tonal sm" disabled={busy || head === headline} onClick={() => run(() => updateHeadline(head), "Saved")}>Save</button>
            <button type="button" className="ds-btn sm" onClick={() => setOpen(true)}><Icon name="add" size={16} /> Add entry</button>
          </div>
        </SectionCard>
      )}
      <SectionCard title="Timeline" icon="award" count={entries.length}>
        {entries.length === 0 ? <p className="cd-muted">{mode === "own" ? "Your quizzes and graded assignments appear here automatically. You can also add achievements yourself." : "No entries yet."}</p> : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
            {entries.map((e) => (
              <li key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <span style={{ display: "grid", gap: 2 }}>
                  <strong>{e.title}</strong>
                  {e.summary && <span>{e.summary}</span>}
                  <small className="cd-muted">{e.type.toLowerCase().replace("_", " ")} · {fmtDate(e.occurredAt)}</small>
                </span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <PillChip tone={e.verified ? "ok" : "warn"}>{e.verified ? "verified" : "self-reported"}</PillChip>
                  {mode === "teacher" && e.manual && <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => run(() => verifyPortfolioEntry(e.id, !e.verified), e.verified ? "Unverified" : "Verified")}>{e.verified ? "Unverify" : "Verify"}</button>}
                  {mode === "own" && e.manual && <button type="button" className="dk-icon-btn" aria-label={`Remove ${e.title}`} disabled={busy} onClick={() => run(() => deletePortfolioEntry(e.id), "Removed")}><Icon name="delete" size={16} /></button>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Add to portfolio" subtitle="A teacher can verify it later."
        footer={<><button type="button" className="ds-btn outline sm" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="ds-btn sm" disabled={busy || !f.title.trim()} onClick={add}>Add</button></>}>
        <div className="cd-grid">
          <Field label="Type"><M3Select value={f.type} onChange={(x) => setF((s) => ({ ...s, type: x }))} options={TYPES} /></Field>
          <Field label="Title" required><input value={f.title} maxLength={255} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></Field>
          <Field label="Details"><textarea rows={3} value={f.summary} maxLength={2000} onChange={(e) => setF((s) => ({ ...s, summary: e.target.value }))} /></Field>
          <Field label="Date"><input type="date" value={f.occurredAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF((s) => ({ ...s, occurredAt: e.target.value }))} /></Field>
        </div>
      </Sheet>
    </>
  );
}
