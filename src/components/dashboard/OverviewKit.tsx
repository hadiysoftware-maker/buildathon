"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mascot, type Mood, type Pose, type MascotProp } from "@/components/ui/Mascot";
import { EmptyState } from "@/components/ui/EmptyState";
import { Motif, MOTIF_ORDER } from "@/components/ui/Motif";

export function useList(url: string): { items: any[]; loading: boolean } {
  const [state, setState] = useState<{ items: any[]; loading: boolean }>({ items: [], loading: true });
  useEffect(() => {
    let live = true;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        const arr = Array.isArray(d)
          ? d
          : d && typeof d === "object"
          ? (Object.values(d).find((v) => Array.isArray(v)) as any[])
          : null;
        setState({ items: arr || [], loading: false });
      })
      .catch(() => live && setState({ items: [], loading: false }));
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Hero({
  eyebrow,
  title,
  text,
  actions,
  mood = "happy",
  pose = "wave",
  prop = "book",
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  text: React.ReactNode;
  actions?: React.ReactNode;
  mood?: Mood;
  pose?: Pose;
  prop?: MascotProp;
}) {
  return (
    <section className="ds-hero">
      <div>
        <p className="ds-hero-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{text}</p>
        {actions && <div className="ds-hero-actions">{actions}</div>}
      </div>
      <div className="ds-hero-mascot hidden lg:block" aria-hidden="true">
        <Mascot mood={mood} pose={pose} prop={prop} size={184} />
      </div>
    </section>
  );
}

export function StatTiles({
  tiles,
}: {
  tiles: {
    icon: any;
    label: string;
    value: React.ReactNode;
    sub?: string;
    href?: string;
    onClick?: () => void;
  }[];
}) {
  return (
    <div className="ds-stats">
      {tiles.map(({ icon: IconComp, label, value, sub, href, onClick }, i) => {
        const body = (
          <>
            <Motif type={MOTIF_ORDER[i % MOTIF_ORDER.length]} />
            <div className="ds-stat-icon">
              <IconComp />
            </div>
            <strong>{value}</strong>
            <span>{label}</span>
            {sub && <small>{sub}</small>}
          </>
        );
        if (href) {
          return (
            <Link key={label} href={href} className="ds-stat">
              {body}
            </Link>
          );
        }
        if (onClick) {
          return (
            <button key={label} type="button" onClick={onClick} className="ds-stat text-left cursor-pointer">
              {body}
            </button>
          );
        }
        return (
          <div key={label} className="ds-stat">
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function ModuleGroupCard({
  icon: IconComp,
  title,
  count,
  subtitle,
  href,
  onClick,
  accent,
}: {
  icon: any;
  title: string;
  count?: number;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  const inner = (
    <>
      <span className="ds-mod-ic">
        <IconComp />
      </span>
      <span className="ds-mod-copy">
        <b>{title}</b>
        <small>{subtitle ?? (typeof count === "number" ? `${count} module${count === 1 ? "" : "s"}` : "Open")}</small>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`ds-mod-card${accent ? " is-accent" : ""}`}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ds-mod-card${accent ? " is-accent" : ""}`}
    >
      {inner}
    </button>
  );
}

export function Panel({
  title,
  subtitle,
  icon: IconComp,
  count,
  action,
  children,
  empty,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: any;
  count?: number;
  action?: React.ReactNode;
  children?: React.ReactNode;
  empty?: { title: string; text: string; mood?: Mood; prop?: MascotProp } | null;
}) {
  return (
    <section className="ds-card">
      <div className="ds-card-head">
        <div>
          <h2>
            {IconComp && <IconComp />} {title}
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {typeof count === "number" && <span className="ds-count">{count}</span>}
          {action}
        </div>
      </div>
      {empty ? (
        <EmptyState mood={empty.mood || "sleepy"} prop={empty.prop || "search"} title={empty.title}>
          {empty.text}
        </EmptyState>
      ) : (
        children
      )}
    </section>
  );
}

export function QuickLinks({
  links,
}: {
  links: { href?: string; onClick?: () => void; label: string; text: string; icon: any }[];
}) {
  return (
    <div className="ds-grid ds-grid-3">
      {links.map(({ href, onClick, label, text, icon: IconComp }) => {
        const inner = (
          <>
            <span className="ds-tile">
              <IconComp />
            </span>
            <div className="ds-grow">
              <h3>{label}</h3>
              <p>{text}</p>
            </div>
          </>
        );
        if (href) {
          return (
            <Link key={label + href} href={href} className="ds-mini ds-quick">
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="ds-mini ds-quick text-left cursor-pointer"
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

