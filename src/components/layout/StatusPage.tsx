"use client";

import Link from "next/link";
import { Mascot, type Mood, type Pose, type MascotProp } from "@/components/ui/Mascot";
import { Logo } from "@/components/ui/Logo";

/**
 * Full-page status screen ported from X:\fest-ms StatusPage:
 * Large outlined status digits with the DNAC Scholar Owl standing in front,
 * editorial typography + pill actions on the left, and recovery links below.
 */
export function StatusPage({
  code,
  mood,
  pose = "wave",
  prop = "none",
  eyebrow,
  title,
  text,
  actions,
  links,
  children,
}: {
  code: string;
  mood: Mood;
  pose?: Pose;
  prop?: MascotProp;
  eyebrow: string;
  title: string;
  text: React.ReactNode;
  actions?: React.ReactNode;
  links?: { href: string; label: string; text: string; icon: any }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="ds-scope st-page">
      <header className="st-top">
        <Link href="/" aria-label="Home">
          <Logo size={30} sub="DNAC KOONANCHERY" />
        </Link>
      </header>

      <main className="st-main">
        <section className="st-copy">
          <p className="st-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="st-text">{text}</p>
          {children}
          {actions && <div className="st-actions">{actions}</div>}
        </section>

        <section className="st-art hidden lg:grid" aria-hidden="true">
          <span className="st-code">{code}</span>
          <span className="st-glow" />
          <div className="st-mascot">
            <Mascot mood={mood} pose={pose} prop={prop} size={235} />
          </div>
        </section>
      </main>

      {links && links.length > 0 && (
        <nav className="st-links" aria-label="Helpful links">
          {links.map(({ href, label, text: t, icon: IconComp }) => (
            <Link key={href} href={href} className="st-link">
              <span className="st-link-ic">
                <IconComp />
              </span>
              <span>
                <b>{label}</b>
                <small>{t}</small>
              </span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

