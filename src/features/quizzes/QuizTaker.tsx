"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { startQuiz, submitQuiz } from "./actions";

interface Q { id: string; type: string; prompt: string; points: number; options: { id: string; label: string }[] }
interface Loaded { title: string; timeLimitSec: number | null; token: string; questions: Q[] }
const L = ["A", "B", "C", "D", "E", "F"];

export function QuizTaker({ quizId, title, questionCount, timeLimitMin }: { quizId: string; title: string; questionCount: number; timeLimitMin: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [quiz, setQuiz] = useState<Loaded | null>(null);
  const [ans, setAns] = useState<Record<string, { optionId?: string; text?: string }>>({});
  const [left, setLeft] = useState<number | null>(null);
  const sent = useRef(false);

  const begin = () =>
    start(async () => {
      const r = await startQuiz(quizId);
      if (!r.ok || !r.data) return void toast.error(r.ok ? "Could not start." : r.error);
      setQuiz(r.data as Loaded);
      setLeft(r.data.timeLimitSec);
    });

  const send = useCallback((auto: boolean) => {
    if (!quiz || sent.current) return;
    sent.current = true;
    start(async () => {
      const r = await submitQuiz(quizId, quiz.token, quiz.questions.map((q) => ({ questionId: q.id, ...ans[q.id] })));
      if (!r.ok) { sent.current = false; return void toast.error(r.error); }
      toast.success(auto ? "Time is up. Your answers were submitted." : "Quiz submitted");
      router.refresh();
    });
  }, [quiz, ans, quizId, router]);

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) { send(true); return; }
    const t = setTimeout(() => setLeft((x) => (x === null ? x : x - 1)), 1000);
    return () => clearTimeout(t);
  }, [left, send]);

  if (!quiz) {
    return (
      <div className="ds-card" style={{ padding: 20, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <p style={{ margin: 0 }}>{questionCount} questions{timeLimitMin ? ` · ${timeLimitMin} minute timer starts when you begin` : " · no time limit"}. You can only attempt this once.</p>
        <div><button type="button" className="ds-btn sm" disabled={busy} onClick={begin}>{busy ? "Loading…" : "Begin quiz"}</button></div>
      </div>
    );
  }
  const done = quiz.questions.filter((q) => ans[q.id]?.optionId || ans[q.id]?.text?.trim()).length;
  const mm = left === null ? "" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <section className="ai-quiz" aria-label={quiz.title}>
      <header>
        <h4>{quiz.title}</h4>
        <span className="ai-quiz-prog" aria-live="polite">{done}/{quiz.questions.length} answered{left !== null ? ` · ${mm} left` : ""}</span>
      </header>
      <div className="ai-quiz-bar" aria-hidden="true"><i style={{ width: `${(done / quiz.questions.length) * 100}%` }} /></div>
      <ol className="ai-quiz-list">
        {quiz.questions.map((q, qi) => (
          <li key={q.id} className="ai-quiz-q">
            <p><span className="ai-quiz-n">{qi + 1}</span>{q.prompt}</p>
            {q.type === "SHORT_ANSWER" ? (
              <input aria-label={`Answer ${qi + 1}`} placeholder="Type your answer" value={ans[q.id]?.text ?? ""} onChange={(e) => setAns((a) => ({ ...a, [q.id]: { text: e.target.value } }))} />
            ) : (
              <div className="ai-quiz-opts" role="radiogroup" aria-label={`Question ${qi + 1}`}>
                {q.options.map((o, oi) => (
                  <button key={o.id} type="button" role="radio" aria-checked={ans[q.id]?.optionId === o.id} data-state={ans[q.id]?.optionId === o.id ? "picked" : "idle"} onClick={() => setAns((a) => ({ ...a, [q.id]: { optionId: o.id } }))}>
                    <b>{L[oi]}</b><span>{o.label}</span>
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="ai-quiz-end"><span>Check your answers, then submit.</span><button type="button" className="ds-btn sm" disabled={busy} onClick={() => send(false)}>{busy ? "Submitting…" : "Submit quiz"}</button></div>
    </section>
  );
}
