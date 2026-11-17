"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { deleteCards, reviewCard } from "./actions";
import "./flashcards.css";

export interface DeckCard { id: string; topic: string; front: string; back: string; box: number; due: boolean }

/** Review the cards that are due (flip, then mark "Got it" or "Again"), and manage the deck. */
export function Review({ cards }: { cards: DeckCard[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const due = cards.filter((c) => c.due);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [doneN, setDoneN] = useState(0);
  const cur = due[i];

  const answer = (ok: boolean) => start(async () => {
    const r = await reviewCard(cur.id, ok);
    if (!r.ok) return void toast.error(r.error);
    setFlip(false); setDoneN((n) => n + 1); setI((x) => x + 1);
    if (i + 1 >= due.length) router.refresh();
  });
  const remove = (id: string) => start(async () => {
    const r = await deleteCards([id]);
    if (!r.ok) return void toast.error(r.error);
    router.refresh();
  });
  const topics = [...new Set(cards.map((c) => c.topic))];

  return (
    <div className="fc">
      {cur ? (
        <section className="fc-stage" aria-label="Review">
          <small className="fc-meta">{cur.topic} · card {i + 1} of {due.length} · box {cur.box}</small>
          <button type="button" className="fc-card" data-flip={flip ? "1" : "0"} onClick={() => setFlip((f) => !f)} aria-label={flip ? "Answer shown. Tap to see the question" : "Tap to show the answer"}>
            <span>{flip ? cur.back : cur.front}</span>
            <small>{flip ? "Answer" : "Tap to flip"}</small>
          </button>
          <div className="fc-actions">
            <button type="button" className="ds-btn tonal sm" disabled={busy || !flip} onClick={() => answer(false)}>Again</button>
            <button type="button" className="ds-btn sm" disabled={busy || !flip} onClick={() => answer(true)}>Got it</button>
          </div>
        </section>
      ) : (
        <p className="fc-empty">{cards.length === 0 ? "No cards yet. Ask Nova: “Make flashcards for today's lesson”." : doneN > 0 ? `All done. You reviewed ${doneN} card${doneN === 1 ? "" : "s"}. They come back when they are due.` : "Nothing due right now. Come back later."}</p>
      )}
      {topics.map((t) => (
        <section key={t} aria-label={t}>
          <h3 className="ll-h">{t}</h3>
          <ul className="fc-list">
            {cards.filter((c) => c.topic === t).map((c) => (
              <li key={c.id}><span><b>{c.front}</b><small>{c.back}</small></span><span className="fc-box" title="Box">{c.box}</span><button type="button" className="ds-icon-btn" aria-label="Delete card" disabled={busy} onClick={() => remove(c.id)}>×</button></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
