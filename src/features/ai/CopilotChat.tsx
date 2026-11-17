"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageWrap } from "@/components/dashboard/Kit";
import { AssistantMessage } from "@/components/ai/AssistantMessage";
import type { AttachedFile, Block } from "@/lib/ai/blocks";
import { AttachButton, FILE_PROMPTS, MessageFiles, PendingChips, useAttachments } from "@/components/ai/Attachments";
import { Icon } from "@/components/ui/Icon";
import { BulkBar } from "@/components/ai/BulkBar";
import { NovaHero } from "@/components/ai/NovaHero";
import { toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const newConvoId = () => "c" + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => (b % 36).toString(36)).join("");
export interface ChatMsg { id: string; role: "USER" | "ASSISTANT"; content: string; blocks?: Block[]; files?: AttachedFile[] }
export interface ConvoItem { id: string; title: string }

export function CopilotChat({ base, aiReady, conversations, activeId, initial, suggestions, eyebrow }: {
  base: string; // e.g. /student/copilot
  aiReady: boolean;
  conversations: ConvoItem[];
  activeId: string | null;
  initial: ChatMsg[];
  suggestions: string[];
  eyebrow: string;
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [cid, setCid] = useState<string | null>(activeId);
  const end = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const att = useAttachments();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const list = conversations.filter((c) => !removed.has(c.id));

  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkAsk, setBulkAsk] = useState(false);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const removeMany = async () => {
    const ids = [...picked];
    const res = await fetch("/api/ai/conversations", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) });
    if (!res.ok) { toast.error("Could not delete the chats."); return; }
    const { deleted } = (await res.json()) as { deleted: number };
    setRemoved((r) => new Set([...r, ...ids]));
    toast.success(`${deleted} chat${deleted === 1 ? "" : "s"} deleted`);
    setPicked(new Set()); setSelecting(false);
    if (cid && ids.includes(cid)) router.replace(base); else router.refresh();
  };
  const removeChat = async (id: string) => {
    const res = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Could not delete the chat."); return; }
    setRemoved((r) => new Set(r).add(id));
    toast.success("Chat deleted");
    if (id === cid) router.replace(base);
    else router.refresh();
  };

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = async (raw: string) => {
    const message = raw.trim() || (att.ids.length ? "Please review the attached file(s)." : "");
    if (!message || sending.current) return;
    if (att.uploading) { toast.error("Wait for the upload to finish."); return; }
    const sentFiles = att.files;
    const sentIds = att.ids;
    sending.current = true;
    const convoId = cid ?? newConvoId();
    setCid(convoId);
    setText("");
    att.clear();
    setBusy(true);
    const mine: ChatMsg = { id: `u${Date.now()}`, role: "USER", content: message, files: sentFiles };
    const reply: ChatMsg = { id: `a${Date.now()}`, role: "ASSISTANT", content: "" };
    setMsgs((m) => [...m, mine, reply]);
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
      if (convoId !== activeId) router.replace(`${base}?c=${convoId}`, { scroll: false });
      router.refresh();
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(e instanceof Error ? e.message : "Something went wrong.");
      setMsgs((m) => m.filter((x) => x.id !== reply.id || x.content));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <PageWrap>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p className="cd-muted" style={{ margin: 0 }}>Nova can be wrong. Check important facts.</p>
        <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
          {cid && list.some((c) => c.id === cid) && (
            <button type="button" className="ds-btn outline sm" onClick={() => setPendingDelete({ id: cid, title: list.find((c) => c.id === cid)?.title ?? "this chat" })}><Icon name="delete" size={16} /> Delete chat</button>
          )}
          <Link href={base} className="ds-btn outline sm"><Icon name="add" size={16} /> New chat</Link>
        </span>
      </div>
      {!aiReady && <div className="cd-banner" data-tone="warn" role="status"><Icon name="alert" size={16} /> The AI service is not configured yet (GROQ_API_KEY is missing), so the copilot cannot answer.</div>}

      <div className="cc-grid">
        <nav aria-label="Past chats" className="cd-card cc-history">
          <div className="cc-history-list">
            {list.length === 0 && <small className="cd-muted" style={{ padding: 8 }}>No chats yet.</small>}
            <BulkBar total={list.length} selected={picked.size} selecting={selecting}
              onToggleMode={() => { setSelecting((x) => !x); setPicked(new Set()); }}
              onSelectAll={() => setPicked(picked.size === list.length ? new Set() : new Set(list.map((c) => c.id)))}
              onDelete={() => setBulkAsk(true)} />
            {list.map((c) => (
              <div key={c.id} className="cc-item">
                {selecting && <input type="checkbox" aria-label={`Select chat ${c.title}`} checked={picked.has(c.id)} onChange={() => toggle(c.id)} />}
                <Link href={`${base}?c=${c.id}`} onClick={(e) => { if (selecting) { e.preventDefault(); toggle(c.id); } }} className="ds-side-link" aria-current={c.id === cid ? "page" : undefined} style={{ minHeight: 36 }}>
                  <span className="ds-label">{c.title}</span>
                </Link>
                {!selecting && <button type="button" className="ds-icon-btn cc-del" onClick={() => setPendingDelete({ id: c.id, title: c.title })} aria-label={`Delete chat ${c.title}`} title="Delete chat"><Icon name="delete" size={16} /></button>}
              </div>
            ))}
          </div>
        </nav>

        <section className="cd-card cc-panel">
          <div className="cc-messages" aria-live="polite">
            {msgs.length === 0 ? (
              <NovaHero size={120} prop="book" fallback={suggestions} disabled={!aiReady || busy} onPick={(t) => void send(t)} />
            ) : (
              msgs.map((m, mi) =>
                m.role === "USER" ? (
                  <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}><div className="cp-msg" data-role="USER" style={{ maxWidth: "min(680px, 90%)" }}>{m.content}<MessageFiles files={m.files} /></div></div>
                ) : (
                  <AssistantMessage key={m.id} content={m.content} blocks={m.blocks} pending={busy} active={mi === msgs.length - 1} onSend={(t) => void send(t)} />
                ),
              )
            )}
            <div ref={end} />
          </div>
          {att.items.length > 0 && (
            <div className="att-stack">
              <PendingChips items={att.items} onRemove={att.remove} />
              <div className="att-prompts">
                {FILE_PROMPTS.map((p) => <button key={p} type="button" className="ds-btn tonal sm" disabled={!aiReady || busy || att.uploading} onClick={() => send(p)}>{p}</button>)}
              </div>
            </div>
          )}
          <form className="cc-form" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <AttachButton onPick={att.add} disabled={!aiReady || busy || att.items.length >= 3} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={aiReady ? (att.items.length ? "Ask about your file…" : "Ask anything…") : "Copilot unavailable"} maxLength={4000} disabled={!aiReady} aria-label="Message" style={{ flex: 1 }} />
            <button type="submit" className="ds-btn sm" disabled={!aiReady || busy || att.uploading || (!text.trim() && !att.ids.length)}><Icon name="send" size={16} /> Send</button>
          </form>
        </section>
      </div>
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
        onConfirm={async () => { if (pendingDelete) await removeChat(pendingDelete.id); setPendingDelete(null); }}
        title="Delete this chat?"
        description={pendingDelete ? `"${pendingDelete.title}" and all its messages will be permanently deleted. This cannot be undone.` : ""}
        confirmText="Delete chat"
        variant="danger"
      />
    </PageWrap>
  );
}
