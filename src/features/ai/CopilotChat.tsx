"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, PageWrap } from "@/components/dashboard/Kit";
import { Icon } from "@/components/ui/Icon";
import { Mascot } from "@/components/ui/Mascot";
import { toast } from "@/components/ui/Toast";

export interface ChatMsg { id: string; role: "USER" | "ASSISTANT"; content: string }
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

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
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
        body: JSON.stringify({ conversationId: cid ?? undefined, message }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? "The copilot could not answer.");
      }
      const newId = res.headers.get("x-conversation-id");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMsgs((m) => m.map((x) => (x.id === reply.id ? { ...x, content: x.content + chunk } : x)));
      }
      if (newId && newId !== cid) {
        setCid(newId);
        router.replace(`${base}?c=${newId}`, { scroll: false });
      }
      router.refresh();
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(e instanceof Error ? e.message : "Something went wrong.");
      setMsgs((m) => m.filter((x) => x.id !== reply.id || x.content));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageWrap>
      <PageHeader eyebrow={eyebrow} title="AI Copilot" description="Ask Nova for help. Answers can be wrong, so check important facts."
        actions={<Link href={base} className="ds-btn outline sm"><Icon name="add" size={16} /> New chat</Link>} />
      {!aiReady && <div className="cd-banner" data-tone="warn" role="status"><Icon name="alert" size={16} /> The AI service is not configured yet (GROQ_API_KEY is missing), so the copilot cannot answer.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)", gap: 16, alignItems: "start" }} className="nv-chat-grid">
        <nav aria-label="Past chats" className="cd-card" style={{ padding: 8 }}>
          <div style={{ display: "grid", gap: 2 }}>
            {conversations.length === 0 && <small className="cd-muted" style={{ padding: 8 }}>No chats yet.</small>}
            {conversations.map((c) => (
              <Link key={c.id} href={`${base}?c=${c.id}`} className="ds-side-link" aria-current={c.id === cid ? "page" : undefined} style={{ minHeight: 36 }}>
                <span className="ds-label">{c.title}</span>
              </Link>
            ))}
          </div>
        </nav>

        <section className="cd-card" style={{ display: "grid", gridTemplateRows: "minmax(320px, 55vh) auto", overflow: "hidden" }}>
          <div style={{ overflowY: "auto", padding: 16, display: "grid", gap: 12, alignContent: "start" }} aria-live="polite">
            {msgs.length === 0 ? (
              <div style={{ display: "grid", justifyItems: "center", gap: 12, padding: "8px 0" }}>
                <Mascot mood="happy" pose="wave" prop="book" size={130} />
                <strong>Hi, I am Nova. What shall we work on?</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {suggestions.map((s) => <button key={s} type="button" className="ds-btn tonal sm" disabled={!aiReady || busy} onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            ) : (
              msgs.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.role === "USER" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "min(680px, 90%)", padding: "10px 14px", borderRadius: 16, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5,
                    background: m.role === "USER" ? "var(--md-primary)" : "var(--md-surface-container-low)", color: m.role === "USER" ? "var(--md-on-primary)" : "var(--md-on-surface)" }}>
                    {m.content || (busy ? "Thinking…" : "")}
                  </div>
                </div>
              ))
            )}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(text); }} style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--md-outline-variant)" }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={aiReady ? "Ask anything…" : "Copilot unavailable"} maxLength={4000} disabled={!aiReady} aria-label="Message" style={{ flex: 1 }} />
            <button type="submit" className="ds-btn sm" disabled={!aiReady || busy || !text.trim()}><Icon name="send" size={16} /> Send</button>
          </form>
        </section>
      </div>
    </PageWrap>
  );
}
