"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Presence } from "@/components/ui/Presence";
import { usePermissions } from "@/providers/permissions-provider";
import { filterSidebarGroups, getFlatNavPages, getSidebarGroups } from "@/lib/nav-config";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
}

/** Ctrl/⌘ K page switcher. Lists only pages the role may see. */
export function CommandPalette({ isOpen, onClose, userRole }: CommandPaletteProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const pages = useMemo(
    () => getFlatNavPages(filterSidebarGroups(getSidebarGroups(userRole), (m) => can(m))),
    [userRole, can],
  );
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? pages.filter((p) => `${p.title} ${p.section}`.toLowerCase().includes(q)) : pages;
  }, [pages, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

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

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <Presence show={isOpen} variant="dialog">
      <div className="dk-overlay" onMouseDown={onClose}>
        <div
          className="dk-sheet sm"
          role="dialog"
          aria-label="Search pages"
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && hits[active]) go(hits[active].href);
          }}
        >
          <div className="dk-sheet-head">
            <input
              ref={inputRef}
              className="dk-search"
              placeholder="Search pages…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
            />
          </div>
          <div className="dk-sheet-body">
            {hits.length === 0 ? (
              <p className="cd-muted">No matching pages.</p>
            ) : (
              <ul className="cd-list">
                {hits.map((h, i) => (
                  <li key={h.href} className="cd-list-item">
                    <button
                      type="button"
                      className={`ds-menu-item${i === active ? " active" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(h.href)}
                    >
                      <span>
                        <Icon name={h.icon} size={17} />
                      </span>
                      <span className="ds-label">
                        {h.title} <small className="cd-muted">· {h.section}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Presence>,
    document.body,
  );
}
