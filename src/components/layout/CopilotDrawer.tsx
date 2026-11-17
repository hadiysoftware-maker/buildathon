"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AssistantMessage } from "@/components/ai/AssistantMessage";
import type { AttachedFile, Block } from "@/lib/ai/blocks";
import { AttachButton, FILE_PROMPTS, MessageFiles, PendingChips, useAttachments } from "@/components/ai/Attachments";
import { Icon } from "@/components/ui/Icon";
import { BulkBar } from "@/components/ai/BulkBar";
import { NovaHero } from "@/components/ai/NovaHero";
import { toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Msg { id: string; role: "USER" | "ASSISTANT"; content: string; blocks?: Block[]; files?: AttachedFile[] }
interface Convo { id: string; title: string; updatedAt: string }

const SUGGEST: Record<string, string[]> = {
  STUDENT: ["Explain this topic simply", "Make me a revision plan", "Quiz me"],
  TEACHER: ["Plan a 40-minute lesson", "Write 5 MCQs with answers", "Draft a note to parents"],
  default: ["Draft a circular", "How do I replace a Smart ID card?", "Outline a term report"],
};

const newConvoId = () => "c" + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => (b % 36).toString(36)).join("");

/** Right-hand Copilot panel with chat history. Opened from the top bar; streams from /api/ai/chat. */
export function CopilotDrawer({ open, onClose, role, fullPageHref }: { open?: boolean; onClose: () => void; role: string; fullPageHref?: string }) {
  const [view, setView] = useState<"chat" | "history">("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [cid, setCid] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkAsk, setBulkAsk] = useState(false);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const end = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const att = useAttachments();

  const loadHistory = useCallback(async () => {
    const r = await fetch("/api/ai/conversations").catch(() => null);
    if (r?.ok) setConvos(((await r.json()) as { items: Convo[] }).items);
  }, []);

  useEffect(() => {
    if (open !== false) void loadHistory();
  }, [open, loadHistory]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, view]);
  useEffect(() => {
    if (open !== true) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  useEffect(() => () => abort.current?.abort(), []);

  const newChat = () => {
    abort.current?.abort();
    setCid(null);
    sending.current = false;
    setBusy(false);
    setMsgs([]);
    setView("chat");
  };

  const openConvo = async (id: string) => {
    const r = await fetch(`/api/ai/conversations/${id}`);
    if (!r.ok) {
      toast.error("Could not open that chat.");
      return;
    }
    setMsgs(((await r.json()) as { messages: Msg[] }).messages);
    setCid(id);
    setView("chat");
  };

  const removeConvo = async (id: string) => {
    const res = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Could not delete the chat."); return; }
    toast.success("Chat deleted");
    if (id === cid) newChat();
    void loadHistory();
  };

  const removeMany = async () => {
    const ids = [...picked];
    const res = await fetch("/api/ai/conversations", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) });
    if (!res.ok) { toast.error("Could not delete the chats."); return; }
    const { deleted } = (await res.json()) as { deleted: number };
    toast.success(`${deleted} chat${deleted === 1 ? "" : "s"} deleted`);
    if (cid && picked.has(cid)) newChat();
    setPicked(new Set()); setSelecting(false);
    void loadHistory();
  };

  const send = async (raw: string) => {
    const message = raw.trim() || (att.ids.length ? "Please review the attached file(s)." : "");
    if (!message || sending.current) return;
    if (att.uploading) { toast.error("Wait for the upload to finish."); return; }
    const sentFiles = att.files;
    const sentIds = att.ids;
    sending.current = true;
    const convoId = cid ?? newConvoId(); // created up front so a retry or double click can never make a second chat
    setCid(convoId);
    setText("");
    att.clear();
    setBusy(true);
    const reply: Msg = { id: `a${Date.now()}`, role: "ASSISTANT", content: "" };
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "USER", content: message, files: sentFiles }, reply]);
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convoId, message, ...(sentIds.length ? { attachments: sentIds } : {}) }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? "The copilot could not answer.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMsgs((m) => m.map((x) => (x.id === reply.id ? { ...x, content: x.content + chunk } : x)));
      }
      void loadHistory();
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(e instanceof Error ? e.message : "Something went wrong.");
      setMsgs((m) => m.filter((x) => x.id !== reply.id || x.content));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const chips = SUGGEST[role] ?? SUGGEST.default;

  return (
    <>
      <div className="cp-scrim" data-open={open === true} onClick={onClose} aria-hidden="true" />
      <aside className="cp-drawer" data-open={open} aria-hidden={open === false} aria-label="AI Copilot">
        <header className="cp-head">
          <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="sparkles" size={18} /> Copilot
          </strong>
          <span style={{ display: "flex", gap: 4 }}>
            <button type="button" className="ds-icon-btn" onClick={newChat} aria-label="New chat" title="New chat"><Icon name="add" size={18} /></button>
            {cid && msgs.length > 0 && view === "chat" && <button type="button" className="ds-icon-btn" onClick={() => setPendingDelete({ id: cid, title: convos.find((c) => c.id === cid)?.title ?? "this chat" })} aria-label="Delete this chat" title="Delete chat"><Icon name="delete" size={18} /></button>}
            <button type="button" className="ds-icon-btn" onClick={() => setView((v) => (v === "chat" ? "history" : "chat"))} aria-label="Chat history" title="History" aria-pressed={view === "history"}><Icon name="history" size={18} /></button>
            {fullPageHref && <Link href={fullPageHref} className="ds-icon-btn" aria-label="Open Copilot as a full page" title="Open full page"><Icon name="external" size={18} /></Link>}
            <button type="button" className="ds-icon-btn" onClick={onClose} aria-label="Close copilot"><Icon name="close" size={18} /></button>
          </span>
        </header>

        {view === "history" ? (
          <div className="cp-body">
            {convos.length === 0 && <p className="cd-muted" style={{ padding: 8 }}>No chats yet.</p>}
            <BulkBar total={convos.length} selected={picked.size} selecting={selecting}
              onToggleMode={() => { setSelecting((x) => !x); setPicked(new Set()); }}
              onSelectAll={() => setPicked(picked.size === convos.length ? new Set() : new Set(convos.map((c) => c.id)))}
              onDelete={() => setBulkAsk(true)} />
            {convos.map((c) => (
              <div key={c.id} className="cp-row" data-active={c.id === cid}>
                {selecting && <input type="checkbox" aria-label={`Select chat ${c.title}`} checked={picked.has(c.id)} onChange={() => toggle(c.id)} />}
                <button type="button" onClick={() => (selecting ? toggle(c.id) : openConvo(c.id))} className="cp-row-main">
                  <span className="ds-label">{c.title}</span>
                  <small className="cd-muted">{new Date(c.updatedAt).toLocaleDateString()}</small>
                </button>
                {!selecting && <button type="button" className="ds-icon-btn" onClick={() => setPendingDelete({ id: c.id, title: c.title })} aria-label={`Delete chat ${c.title}`}><Icon name="delete" size={16} /></button>}
              </div>
            ))}
          </div>
        ) : (
          <div className="cp-body" aria-live="polite">
            {msgs.length === 0 ? (
              <NovaHero size={96} fallback={chips} disabled={busy} onPick={(t) => void send(t)} />
            ) : (
              msgs.map((m, mi) => (
                m.role === "USER" ? (
                  <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}><div className="cp-msg" data-role="USER">{m.content}<MessageFiles files={m.files} /></div></div>
                ) : (
                  <AssistantMessage key={m.id} content={m.content} blocks={m.blocks} pending={busy} active={mi === msgs.length - 1} onSend={(t) => void send(t)} />
                )
              ))
            )}
            <div ref={end} />
          </div>
        )}

        {view === "chat" && (att.items.length > 0) && (
          <div className="att-stack">
            <PendingChips items={att.items} onRemove={att.remove} />
            <div className="att-prompts">
              {FILE_PROMPTS.map((p) => <button key={p} type="button" className="ds-btn tonal sm" disabled={busy || att.uploading} onClick={() => send(p)}>{p}</button>)}
            </div>
          </div>
        )}
        {view === "chat" && (
          <form className="cp-form" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <AttachButton onPick={att.add} disabled={busy || att.items.length >= 3} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={att.items.length ? "Ask about your file…" : "Ask anything…"} maxLength={4000} aria-label="Message" />
            <button type="submit" className="ds-btn sm" disabled={busy || att.uploading || (!text.trim() && !att.ids.length)} aria-label="Send"><Icon name="send" size={16} /></button>
          </form>
        )}
      </aside>
      <ConfirmModal
        isOpen={bulkAsk}
        onClose={() => setBulkAsk(false)}
        onConfirm={async () => { await removeMany(); setBulkAsk(false); }}
        title={`Delete ${picked.size} chat${picked.size === 1 ? "" : "s"}?`}
        description="The selected chats and all their messages will be permanently deleted. This cannot be undone."
        confirmText="Delete chats"
      />
      <ConfirmModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => { if (pendingDelete) await removeConvo(pendingDelete.id); setPendingDelete(null); }}
        title="Delete this chat?"
        description={pendingDelete ? `"${pendingDelete.title}" and all its messages will be permanently deleted. This cannot be undone.` : ""}
        confirmText="Delete chat"
        variant="danger"
      />
    </>
  );
}
