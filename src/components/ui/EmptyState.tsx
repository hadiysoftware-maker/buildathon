"use client";

import type { ReactNode } from "react";
import { Mascot, type MascotProp, type Mood, type Pose } from "./Mascot";

export function EmptyState({
  title,
  hint,
  children,
  action,
  mood = "sleepy",
  pose = "rest",
  prop = "search",
  size = 132,
  compact = false,
}: {
  title?: ReactNode;
  hint?: string;
  children?: ReactNode;
  action?: ReactNode;
  mood?: Mood;
  pose?: Pose;
  prop?: MascotProp;
  size?: number;
  compact?: boolean;
}) {
  const body = children ?? hint;
  return (
    <div className={`ds-emptystate${compact ? " compact" : ""}`}>
      <div className="ds-empty-mascot hidden lg:block">
        <Mascot mood={mood} pose={pose} prop={prop} size={size} />
      </div>
      {title && <strong>{title}</strong>}
      {body && <span>{body}</span>}
      {action}
    </div>
  );
}

export function MascotPage({
  mood,
  pose = "wave",
  prop = "none",
  eyebrow,
  title,
  children,
  actions,
}: {
  mood: Mood;
  pose?: Pose;
  prop?: MascotProp;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="ds-mascot-page">
      <div className="ds-mascot-page-art hidden lg:block">
        <Mascot mood={mood} pose={pose} prop={prop} size={prop === "none" ? 210 : 250} />
      </div>
      {eyebrow && <p className="ds-mascot-page-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <p className="ds-mascot-page-text">{children}</p>}
      {actions && <div className="ds-hero-actions">{actions}</div>}
    </div>
  );
}
