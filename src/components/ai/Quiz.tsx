"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { recordPracticeAttempt } from "@/features/ai/practice";

type Q = { q: string; options: string[]; answer: number; why?: string };
const LETTERS = ["A", "B", "C", "D", "E"];

/** Interactive quiz card: pick an answer, see right or wrong with the explanation, then a final score. */
export function Quiz({ title, questions }: { title: string; questions: Q[] }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const done = picked.filter((p) => p !== null).length;
  const score = picked.reduce<number>((n, p, i) => n + (p === questions[i].answer ? 1 : 0), 0);
  const finished = done === questions.length;
  const saved = useRef(false);
  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    void recordPracticeAttempt({
      topic: title,
      questions: questions.map((q, i) => ({ q: q.q, picked: q.options[picked[i] ?? 0] ?? "", correct: q.options[q.answer] ?? "", isCorrect: picked[i] === q.answer, why: q.why })),
    });
  }, [finished, questions, picked, title]);

  return (
    <section className="ai-quiz" aria-label={title}>
      <header>
        <h4>{title}</h4>
        <span className="ai-quiz-prog" aria-live="polite">{finished ? `Score ${score}/${questions.length}` : `${done}/${questions.length} answered`}</span>
      </header>
      <div className="ai-quiz-bar" aria-hidden="true"><i style={{ width: `${(done / questions.length) * 100}%` }} /></div>
      <ol className="ai-quiz-list">
        {questions.map((q, qi) => {
          const sel = picked[qi];
          const answered = sel !== null;
          return (
            <li key={qi} className="ai-quiz-q">
              <p><span className="ai-quiz-n">{qi + 1}</span>{q.q}</p>
              <div className="ai-quiz-opts" role="radiogroup" aria-label={`Question ${qi + 1}`}>
                {q.options.map((o, oi) => {
                  const state = !answered ? "idle" : oi === q.answer ? "right" : oi === sel ? "wrong" : "dim";
                  return (
                    <button key={oi} type="button" role="radio" aria-checked={sel === oi} data-state={state} disabled={answered} onClick={() => setPicked((p) => p.map((x, i) => (i === qi ? oi : x)))}>
                      <b>{LETTERS[oi]}</b><span>{o}</span>
                      {state === "right" && <Icon name="check" size={15} />}
                      {state === "wrong" && <Icon name="close" size={15} />}
                    </button>
                  );
                })}
              </div>
              {answered && <p className="ai-quiz-why" data-ok={sel === q.answer ? "1" : "0"}>{sel === q.answer ? "Correct." : `Not quite. The answer is ${LETTERS[q.answer]}.`} {q.why}</p>}
            </li>
          );
        })}
      </ol>
      {finished && (
        <div className="ai-quiz-end">
          <strong>{score === questions.length ? "Perfect score!" : score >= questions.length / 2 ? "Nice work!" : "Keep practising!"}</strong> You got {score} of {questions.length}.
          <button type="button" className="ds-btn outline sm" onClick={() => { saved.current = false; setPicked(questions.map(() => null)); }}>Try again</button>
        </div>
      )}
    </section>
  );
}
