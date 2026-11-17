"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Presence } from "@/components/ui/Presence";
import { usePermissions } from "@/providers/permissions-provider";
import { filterSidebarGroups, getFlatNavPages, getSidebarGroups } from "@/lib/nav-config";
import { commandsFor, type CommandAction } from "@/lib/commands";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
  userId: string;
  onAction?: (a: CommandAction) => void;
}

interface Entry {
  key: string;
  group: string;
  title: string;
  trail?: string;
  icon: IconName;
  href?: string;
  action?: CommandAction;
  search: string;
}

const RECENT_MAX = 4;
const recentKey = (userId: string) => `c35_recent_${userId}`;
const readRecent = (userId: string): string[] => {
  try { return JSON.parse(localStorage.getItem(recentKey(userId)) ?? "[]") as string[]; } catch { return []; }
};

/**
 * Ctrl/Cmd K palette. Everything listed is chosen per role: pages from that role's navigation and commands from
 * `commands.ts`, both filtered by the user's permissions. Recent picks are remembered per user in this browser.
 */
export function CommandPalette({ isOpen, onClose, userRole, userId, onAction }: CommandPaletteProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const all = useMemo<Entry[]>(() => {
    const pages: Entry[] = getFlatNavPages(filterSidebarGroups(getSidebarGroups(userRole), (m) => can(m))).map((p) => ({
      key: `p:${p.href}`, group: "Pages", title: p.title, trail: p.section, icon: p.icon, href: p.href, search: `${p.title} ${p.section}`.toLowerCase(),
    }));
    const cmds: Entry[] = commandsFor(userRole)
      .filter((c) => can(c.perm))
      .map((c) => ({ key: `c:${c.id}`, group: c.section, title: c.title, icon: c.icon, href: c.href, action: c.action, search: `${c.title} ${c.section} ${c.keywords ?? ""}`.toLowerCase() }));
    return [...pages, ...cmds];
  }, [userRole, can]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const hit = all.filter((e) => q.split(/\s+/).every((w) => e.search.includes(w)));
      return hit.length ? [{ label: "Results", items: hit }] : [];
    }
    const byKey = new Map(all.map((e) => [e.key, e]));
    const rec = recent.map((k) => byKey.get(k)).filter((e): e is Entry => !!e);
    const groups = new Map<string, Entry[]>();
    for (const e of all) if (!rec.includes(e)) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
    return [...(rec.length ? [{ label: "Recent", items: rec }] : []), ...[...groups].map(([label, items]) => ({ label, items }))];
  }, [all, query, recent]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActive(0);
    setRecent(readRecent(userId));
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen, userId]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, sections]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const choose = (e: Entry) => {
    try { localStorage.setItem(recentKey(userId), JSON.stringify([e.key, ...readRecent(userId).filter((k) => k !== e.key)].slice(0, RECENT_MAX))); } catch { /* ignore */ }
    onClose();
    if (e.action) onAction?.(e.action);
    else if (e.href) router.push(e.href);
  };

  if (typeof document === "undefined") return null;
  let idx = -1;
  return createPortal(
    <Presence show={isOpen} variant="dialog">
      <div className="dk-overlay" onMouseDown={onClose}>
        <div
          className="cmdk"
          role="dialog"
          aria-modal="true"
          aria-label="Search pages and commands"
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && flat[active]) { e.preventDefault(); choose(flat[active]); }
          }}
        >
          <div className="cmdk-head">
            <Icon name="search" size={18} />
            <input
              ref={inputRef}
              className="cmdk-input"
              placeholder="Search pages and commands"
              aria-label="Search pages and commands"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            />
            <button type="button" className="cmdk-x" onClick={onClose} aria-label="Close search"><Icon name="close" size={18} /></button>
          </div>

          <div className="cmdk-body" ref={listRef} role="listbox" aria-label="Results">
            {flat.length === 0 ? (
              <p className="cmdk-empty">Nothing matches “{query}”.</p>
            ) : (
              sections.map((s) => (
                <Fragment key={s.label}>
                  <div className="cmdk-group" role="presentation">{s.label}</div>
                  {s.items.map((it) => {
                    const i = ++idx;
                    return (
                      <button
                        key={it.key}
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        data-active={i === active}
                        className="cmdk-row"
                        onMouseMove={() => setActive(i)}
                        onClick={() => choose(it)}
                      >
                        <Icon name={it.icon} size={18} />
                        <span className="cmdk-label">
                          {it.trail && <span className="cmdk-trail">{it.trail} <span aria-hidden="true">›</span> </span>}
                          <strong>{it.title}</strong>
                        </span>
                        {i === active && <kbd className="cmdk-enter" aria-hidden="true">↵</kbd>}
                      </button>
                    );
                  })}
                </Fragment>
              ))
            )}
          </div>

          <div className="cmdk-foot" aria-hidden="true">
            <span>Select <kbd>↑</kbd><kbd>↓</kbd></span>
            <span>Open <kbd>↵</kbd></span>
            <span>Close <kbd>Esc</kbd></span>
          </div>
        </div>
      </div>
    </Presence>,
    document.body,
  );
}
