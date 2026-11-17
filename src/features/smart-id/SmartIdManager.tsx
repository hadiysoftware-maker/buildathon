"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, PageHeader, PageWrap, PillChip, SearchBox, Sheet, Toolbar, type Column } from "@/components/dashboard/Kit";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { CardSheet } from "@/components/smart-id/CardSheet";
import { fmtDateTime } from "@/lib/format";
import type { CardView } from "./card";
import * as S from "./actions";

export interface LogEntry { id: string; result: string; method: string; portal: string | null; at: string }
export interface PersonRow {
  id: string; // userId
  name: string;
  code: string;
  role: "Student" | "Teacher";
  credentialId: string | null;
  cardStatus: "ACTIVE" | "SUSPENDED" | "REVOKED" | "REPLACED" | null;
  cardNumber: number | null;
  issuedAt: string | null;
  lastUsedAt: string | null;
  logs: LogEntry[];
}

type Kind = "revoke" | "suspend" | "replace" | "sessions";
type Pending = { kind: Kind; row: PersonRow } | null;
const tone = (s: string | null) => (s === "ACTIVE" ? "ok" : s === "SUSPENDED" ? "warn" : s ? "bad" : "neutral");

const COPY: Record<Kind, { title: string; text: string; cta: string }> = {
  revoke: { title: "Revoke this card?", text: "The card stops working immediately and the person is signed out on every device. A revoked card cannot be reactivated; issue a replacement instead.", cta: "Revoke" },
  suspend: { title: "Suspend this card?", text: "Sign-in is blocked until you reactivate it. Existing sessions end.", cta: "Suspend" },
  replace: { title: "Replace this card?", text: "The old card is invalidated and signed out everywhere. A new card is generated. Print it before closing the next window.", cta: "Replace" },
  sessions: { title: "Sign out everywhere?", text: "Ends every active session for this person. Their card keeps working.", cta: "Sign out" },
};

export function SmartIdManager({ rows }: { rows: PersonRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const [cards, setCards] = useState<CardView[]>([]);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [history, setHistory] = useState<PersonRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => `${r.name} ${r.code} ${r.role} ${r.cardStatus ?? "none"}`.toLowerCase().includes(s)) : rows;
  }, [rows, q]);
  const needCard = (r: PersonRow) => !r.cardStatus || r.cardStatus === "REVOKED" || r.cardStatus === "REPLACED";

  const run = (fn: () => Promise<{ ok: boolean }>, okMsg: string) =>
    start(async () => {
      const r = (await fn()) as { ok: boolean; error?: string };
      if (r.ok) { toast.success(okMsg); router.refresh(); } else toast.error(r.error ?? "Failed");
    });

  const issue = (row: PersonRow) =>
    start(async () => {
      const r = await S.issueCard(row.id);
      if (r.ok) { setCards([r.data]); router.refresh(); } else toast.error(r.error);
    });

  const bulk = () =>
    start(async () => {
      const r = await S.bulkIssueCards([...selected]);
      if (!r.ok) return void toast.error(r.error);
      setSelected(new Set());
      if (r.data.skipped) toast.error(`${r.data.skipped} skipped (already have a card or inactive).`);
      setCards(r.data.cards);
      router.refresh();
    });

  const doConfirm = async () => {
    if (!confirm) return;
    const { kind, row } = confirm;
    setConfirm(null);
    const cid = row.credentialId;
    if (kind === "replace" && cid) {
      start(async () => {
        const r = await S.replaceCard(cid, "Replaced by admin");
        if (r.ok) { setCards([r.data]); router.refresh(); } else toast.error(r.error);
      });
    } else if (kind === "revoke" && cid) run(() => S.revokeCard(cid, "Revoked by admin"), "Card revoked and sessions ended");
    else if (kind === "suspend" && cid) run(() => S.suspendCard(cid, "Suspended by admin"), "Card suspended");
    else if (kind === "sessions") run(() => S.revokeSessionsFor(row.id), "Signed out everywhere");
  };

  const columns: Column<PersonRow>[] = [
    {
      key: "sel", label: "",
      render: (r) => needCard(r) ? (
        <input type="checkbox" aria-label={`Select ${r.name}`} style={{ width: 18, minHeight: 18 }} checked={selected.has(r.id)}
          onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
      ) : null,
    },
    { key: "name", label: "Person", render: (r) => <span><strong>{r.name}</strong><br /><small className="cd-muted">{r.code} · {r.role}</small></span> },
    { key: "card", label: "Card", render: (r) => <PillChip tone={tone(r.cardStatus)}>{r.cardStatus ? `${r.cardStatus.toLowerCase()} · #${r.cardNumber}` : "none"}</PillChip> },
    { key: "last", label: "Last used", render: (r) => (r.lastUsedAt ? fmtDateTime(r.lastUsedAt) : <span className="cd-muted">Never</span>) },
    {
      key: "act", label: "", align: "right",
      render: (r) => (
        <span className="inline-flex gap-1">
          {needCard(r) && <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => issue(r)}><Icon name="qr" size={14} /> Issue</button>}
          {r.cardStatus === "ACTIVE" && <button type="button" className="dk-icon-btn" title="Suspend" aria-label="Suspend card" onClick={() => setConfirm({ kind: "suspend", row: r })}><Icon name="lock" size={16} /></button>}
          {r.cardStatus === "SUSPENDED" && r.credentialId && <button type="button" className="dk-icon-btn" title="Reactivate" aria-label="Reactivate card" disabled={busy} onClick={() => run(() => S.reactivateCard(r.credentialId!), "Card reactivated")}><Icon name="check" size={16} /></button>}
          {(r.cardStatus === "ACTIVE" || r.cardStatus === "SUSPENDED") && (
            <>
              <button type="button" className="dk-icon-btn" title="Replace (lost or damaged)" aria-label="Replace card" onClick={() => setConfirm({ kind: "replace", row: r })}><Icon name="refresh" size={16} /></button>
              <button type="button" className="dk-icon-btn" title="Revoke" aria-label="Revoke card" onClick={() => setConfirm({ kind: "revoke", row: r })}><Icon name="shieldAlert" size={16} /></button>
            </>
          )}
          <button type="button" className="dk-icon-btn" title="Sign out everywhere" aria-label="Sign out everywhere" onClick={() => setConfirm({ kind: "sessions", row: r })}><Icon name="signout" size={16} /></button>
          <button type="button" className="dk-icon-btn" title="Sign-in history" aria-label="Sign-in history" onClick={() => setHistory(r)}><Icon name="history" size={16} /></button>
        </span>
      ),
    },
  ];

  return (
    <PageWrap>
      <PageHeader
        eyebrow="Security" title="Smart ID cards"
        description="Issue, replace, suspend and revoke cards. The QR secret is shown only once, at issue time."
        actions={selected.size > 0 ? <button type="button" className="ds-btn sm" disabled={busy} onClick={bulk}><Icon name="qr" size={16} /> Issue {selected.size} card{selected.size > 1 ? "s" : ""}</button> : undefined}
      />
      <Toolbar><SearchBox value={q} onChange={setQ} placeholder="Search by name, code or status…" /></Toolbar>
      <DataTable rows={filtered} columns={columns} rowKey={(r) => r.id} empty={{ title: "No people yet", text: "Create students or teachers first." }} />
      <CardSheet cards={cards} onClose={() => setCards([])} />
      <ConfirmModal
        isOpen={!!confirm} onClose={() => setConfirm(null)}
        title={confirm ? COPY[confirm.kind].title : ""}
        description={confirm ? `${confirm.row.name}: ${COPY[confirm.kind].text}` : ""}
        confirmText={confirm ? COPY[confirm.kind].cta : ""}
        variant="warning" onConfirm={doConfirm}
      />
      <Sheet open={!!history} onClose={() => setHistory(null)} title="Sign-in history" subtitle={history?.name}>
        {history && history.logs.length === 0 ? <p className="cd-muted">No sign-in attempts recorded.</p> : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {history?.logs.map((l) => (
              <li key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span><PillChip tone={l.result === "SUCCESS" ? "ok" : "bad"}>{l.result.toLowerCase().replace(/_/g, " ")}</PillChip> <small className="cd-muted">{l.method.toLowerCase().replace(/_/g, " ")}{l.portal ? ` · ${l.portal}` : ""}</small></span>
                <small className="cd-muted">{fmtDateTime(l.at)}</small>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </PageWrap>
  );
}
