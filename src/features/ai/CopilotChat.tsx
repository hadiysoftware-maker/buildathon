"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageWrap } from "@/components/dashboard/Kit";
import { AssistantMessage } from "@/components/ai/AssistantMessage";
import type { Block } from "@/lib/ai/blocks";
import { Icon } from "@/components/ui/Icon";
import { Mascot } from "@/components/ui/Mascot";
import { toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const newConvoId = () => "c" + Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => (b % 36).toString(36)).join("");
export interface ChatMsg { id: string; role: "USER" | "ASSISTANT"; content: string; blocks?: Block[] }
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
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const list = conversations.filter((c) => !removed.has(c.id));

  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
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
    const message = raw.trim();
    if (!message || sending.current) return;
    sending.current = true;
    const convoId = cid ?? newConvoId();
    setCid(convoId);
    setText("");
    setBusy(true);
    const mine: ChatMsg = { id: `u${Date.now()}`, role: "USER", content: message };
    const reply: ChatMsg = { id: `a${Date.now()}`, role: "ASSISTANT", content: "" };
    setMsgs((m) => [...m, mine, reply]);
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convoId, message }),
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
            {list.map((c) => (
              <div key={c.id} className="cc-item">
                <Link href={`${base}?c=${c.id}`} className="ds-side-link" aria-current={c.id === cid ? "page" : undefined} style={{ minHeight: 36 }}>
                  <span className="ds-label">{c.title}</span>
                </Link>
                <button type="button" className="ds-icon-btn cc-del" onClick={() => setPendingDelete({ id: c.id, title: c.title })} aria-label={`Delete chat ${c.title}`} title="Delete chat"><Icon name="delete" size={16} /></button>
              </div>
            ))}
          </div>
        </nav>

        <section className="cd-card cc-panel">
          <div className="cc-messages" aria-live="polite">
            {msgs.length === 0 ? (
              <div className="cc-empty">
                <Mascot mood="happy" pose="wave" prop="book" size={130} label="Nova, your study buddy" />
                <strong>Hi, I am Nova. What shall we work on?</strong>
                <div className="cc-chips">
                  {suggestions.map((s) => <button key={s} type="button" className="ds-btn tonal sm" disabled={!aiReady || busy} onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            ) : (
              msgs.map((m) =>
                m.role === "USER" ? (
                  <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}><div className="cp-msg" data-role="USER" style={{ maxWidth: "min(680px, 90%)" }}>{m.content}</div></div>
                ) : (
                  <AssistantMessage key={m.id} content={m.content} blocks={m.blocks} pending={busy} />
                ),
              )
            )}
            <div ref={end} />
          </div>
          <form className="cc-form" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={aiReady ? "Ask anything…" : "Copilot unavailable"} maxLength={4000} disabled={!aiReady} aria-label="Message" style={{ flex: 1 }} />
            <button type="submit" className="ds-btn sm" disabled={!aiReady || busy || !text.trim()}><Icon name="send" size={16} /> Send</button>
          </form>
        </section>
      </div>
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
