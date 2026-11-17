"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/ui/Mascot";
import "./hero.css";

interface Hero { greeting: string; actions: { label: string; prompt: string; hint?: string }[]; agents: { name: string; blurb: string; prompt: string }[] }

/** Welcome screen: a time-aware greeting, live one-tap actions from the user's own data, and the agents Nova can call. */
export function NovaHero({ size = 96, prop, fallback, disabled, onPick }: { size?: number; prop?: "book"; fallback: string[]; disabled?: boolean; onPick: (text: string) => void }) {
  const [h, setH] = useState<Hero | null>(null);
  useEffect(() => {
    let off = false;
    fetch("/api/ai/hero").then((r) => (r.ok ? r.json() : null)).then((j) => { if (!off && j) setH(j as Hero); }).catch(() => undefined);
    return () => { off = true; };
  }, []);
  const actions: { label: string; prompt: string; hint?: string }[] = h?.actions ?? fallback.slice(0, 3).map((label) => ({ label, prompt: label }));
  return (
    <div className="nh">
      <Mascot mood="happy" pose="wave" prop={prop} size={size} label="Nova, your study buddy" />
      <strong className="nh-title">{h?.greeting ?? "Hi"}. I am Nova.</strong>
      <small className="nh-sub">Tap something, or ask me anything.</small>
      <div className="nh-actions">
        {actions.map((a) => (
          <button key={a.label} type="button" disabled={disabled} onClick={() => onPick(a.prompt)}>
            <span>{a.label}</span>{a.hint ? <small>{a.hint}</small> : null}
          </button>
        ))}
      </div>
      {h && (
        <div className="nh-agents" aria-label="Agents Nova can use">
          <span className="nh-cap">My agents</span>
          <ul>
            {h.agents.map((g) => (
              <li key={g.name}><button type="button" disabled={disabled} onClick={() => onPick(g.prompt)}><b>{g.name}</b><small>{g.blurb}</small></button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
