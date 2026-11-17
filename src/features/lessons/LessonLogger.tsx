"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import { deleteLesson, saveLesson } from "./actions";

export interface Slot { key: string; divisionId: string; subjectId: string; label: string; time?: string; logged?: { id: string; topic: string; homework: string | null } | null }
export interface PastLesson { id: string; label: string; date: string; topic: string }

/** One card per class period today: type the topic, press Save. Logged periods show what was recorded. */
export function LessonLogger({ slots, past }: { slots: Slot[]; past: PastLesson[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, { topic: string; homework: string }>>({});
  const set = (k: string, f: "topic" | "homework", v: string) => setDraft((d) => ({ ...d, [k]: { topic: d[k]?.topic ?? "", homework: d[k]?.homework ?? "", [f]: v } }));

  const save = (s: Slot) => start(async () => {
    const d = draft[s.key];
    const r = await saveLesson({ divisionId: s.divisionId, subjectId: s.subjectId, topic: d?.topic ?? "", homework: d?.homework });
    if (!r.ok) return void toast.error(r.error);
    toast.success("Lesson recorded");
    setDraft((x) => ({ ...x, [s.key]: { topic: "", homework: "" } }));
    router.refresh();
  });
  const del = (id: string) => start(async () => {
    const r = await deleteLesson(id);
    if (!r.ok) return void toast.error(r.error);
    router.refresh();
  });

  return (
    <div className="ll">
      {slots.length === 0 ? <p className="cd-muted">No classes to log. Ask an admin to assign you to a class.</p> : (
        <ul className="ll-grid">
          {slots.map((s) => (
            <li key={s.key} className="ll-card" data-done={s.logged ? "1" : "0"}>
              <header><strong>{s.label}</strong>{s.time ? <small>{s.time}</small> : null}</header>
              {s.logged ? (
                <div className="ll-done">
                  <span>{s.logged.topic}</span>
                  {s.logged.homework ? <small>Homework: {s.logged.homework}</small> : null}
                  <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => del(s.logged!.id)}>Remove</button>
                </div>
              ) : (
                <div className="ll-form">
                  <input aria-label={`What did you teach ${s.label}?`} placeholder="What did you teach?" maxLength={200} value={draft[s.key]?.topic ?? ""} onChange={(e) => set(s.key, "topic", e.target.value)} />
                  <input aria-label={`Homework for ${s.label}`} placeholder="Homework (optional)" maxLength={500} value={draft[s.key]?.homework ?? ""} onChange={(e) => set(s.key, "homework", e.target.value)} />
                  <button type="button" className="ds-btn sm" disabled={busy || (draft[s.key]?.topic ?? "").trim().length < 2} onClick={() => save(s)}>Save</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <section aria-label="Recent lessons">
          <h3 className="ll-h">Recent lessons</h3>
          <ul className="ll-past">
            {past.map((p) => <li key={p.id}><span>{p.date}</span><b>{p.label}</b><span>{p.topic}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
