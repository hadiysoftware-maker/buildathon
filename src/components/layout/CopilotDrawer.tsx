"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Mascot } from "@/components/ui/Mascot";
import { toast } from "@/components/ui/Toast";

interface Msg { id: string; role: "USER" | "ASSISTANT"; content: string }
interface Convo { id: string; title: string; updatedAt: string }

const SUGGEST: Record<string, string[]> = {
  STUDENT: ["Explain this topic simply", "Make me a revision plan", "Quiz me"],
  TEACHER: ["Plan a 40-minute lesson", "Write 5 MCQs with answers", "Draft a note to parents"],
  default: ["Draft a circular", "How do I replace a Smart ID card?", "Outline a term report"],
};

/** Right-hand Copilot panel with chat history. Opened from the top bar; streams from /api/ai/chat. */
export function CopilotDrawer({ open, onClose, role }: { open: boolean; onClose: () => void; role: string }) {
  const [view, setView] = useState<"chat" | "history">("chat");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [cid, setCid] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    const r = await fetch("/api/ai/conversations").catch(() => null);
    if (r?.ok) setConvos(((await r.json()) as { items: Convo[] }).items);
  }, []);

  useEffect(() => {
    if (open) void loadHistory();
  }, [open, loadHistory]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, view]);
  useEffect(() => {
    if (!open) return;
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
    await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (id === cid) newChat();
    void loadHistory();
  };

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    setText("");
    setBusy(true);
    const reply: Msg = { id: `a${Date.now()}`, role: "ASSISTANT", content: "" };
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "USER", content: message }, reply]);
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: cid ?? undefined, message }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? "The copilot could not answer.");
      }
      const id = res.headers.get("x-conversation-id");
      if (id) setCid(id);
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
      setBusy(false);
    }
  };

  const chips = SUGGEST[role] ?? SUGGEST.default;

  return (
    <>
      {open && <div className="cp-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className="cp-drawer" data-open={open} aria-hidden={!open} aria-label="AI Copilot">
        <header className="cp-head">
          <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="sparkles" size={18} /> Copilot
          </strong>
          <span style={{ display: "flex", gap: 4 }}>
            <button type="button" className="ds-icon-btn" onClick={newChat} aria-label="New chat" title="New chat"><Icon name="add" size={18} /></button>
            <button type="button" className="ds-icon-btn" onClick={() => setView((v) => (v === "chat" ? "history" : "chat"))} aria-label="Chat history" title="History" aria-pressed={view === "history"}><Icon name="history" size={18} /></button>
            <button type="button" className="ds-icon-btn" onClick={onClose} aria-label="Close copilot"><Icon name="close" size={18} /></button>
          </span>
        </header>

        {view === "history" ? (
          <div className="cp-body">
            {convos.length === 0 && <p className="cd-muted" style={{ padding: 8 }}>No chats yet.</p>}
            {convos.map((c) => (
              <div key={c.id} className="cp-row" data-active={c.id === cid}>
                <button type="button" onClick={() => openConvo(c.id)} className="cp-row-main">
                  <span className="ds-label">{c.title}</span>
                  <small className="cd-muted">{new Date(c.updatedAt).toLocaleDateString()}</small>
                </button>
                <button type="button" className="ds-icon-btn" onClick={() => removeConvo(c.id)} aria-label={`Delete chat ${c.title}`}><Icon name="delete" size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="cp-body" aria-live="polite">
            {msgs.length === 0 ? (
              <div style={{ display: "grid", justifyItems: "center", gap: 10, padding: "12px 4px" }}>
                <Mascot mood="happy" pose="wave" size={96} />
                <strong>Hi, I am Nova. How can I help?</strong>
                {chips.map((s) => (
                  <button key={s} type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            ) : (
              msgs.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.role === "USER" ? "flex-end" : "flex-start" }}>
                  <div className="cp-msg" data-role={m.role}>{m.content || (busy ? "Thinking…" : "")}</div>
                </div>
              ))
            )}
            <div ref={end} />
          </div>
        )}

        {view === "chat" && (
          <form className="cp-form" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything…" maxLength={4000} aria-label="Message" />
            <button type="submit" className="ds-btn sm" disabled={busy || !text.trim()} aria-label="Send"><Icon name="send" size={16} /></button>
          </form>
        )}
      </aside>
    </>
  );
}
