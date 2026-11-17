"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { TopProgress } from "@/components/ui/TopProgress";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NotificationBell } from "./NotificationBell";
import type { ShellUser } from "@/providers/permissions-provider";

interface HeaderProps {
  user: ShellUser;
  homeHref: string;
  pageName?: string;
  onMenuClick?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenAccount?: () => void;
  onToggleCopilot?: () => void;
  copilotOpen?: boolean;
}

/** Top bar (`.ds-topbar`): search pill (Ctrl K) · notifications, theme toggle and user menu. */
export function Header({ homeHref, user, onOpenCommandPalette, onOpenAccount, onToggleCopilot, copilotOpen }: HeaderProps) {
  const roleDisplay = user.role.replace(/_/g, " ").toLowerCase();
  const displayName = user.fullName;
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!userRef.current?.contains(e.target as Node)) setUserOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <header className="ds-topbar">
      <TopProgress />

      <div className="ds-topbar-left">
        <Link href={homeHref} className="ds-brand" aria-label="EduCore home">
          <Logo size={34} sub="" />
        </Link>
      </div>

      <div className="ds-topbar-center">
        <button type="button" className="ds-search" onClick={onOpenCommandPalette} aria-label="Search workspace">
          <Icon name="search" size={18} />
          <span className="ds-label">Search pages…</span>
          <kbd className="ds-kbd">Ctrl K</kbd>
        </button>
      </div>

      <div className="ds-topbar-right">
        <button type="button" onClick={onOpenCommandPalette} className="ds-icon-btn ds-mobile-only" aria-label="Search">
          <Icon name="search" size={19} />
        </button>

        {onToggleCopilot && (
          <button type="button" className="ds-icon-btn" onClick={onToggleCopilot} aria-label="AI Copilot" aria-pressed={copilotOpen === undefined ? undefined : copilotOpen} title="AI Copilot">
            <Icon name="sparkles" size={19} />
          </button>
        )}

        <NotificationBell />

        <div ref={userRef} className="ds-userbox">
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            className="ds-userpill"
            aria-haspopup="menu"
            aria-expanded={userOpen}
            aria-label={`Account menu (${displayName})`}
          >
            <span className="ds-avatar" style={{ width: 34, height: 34, fontSize: 13, overflow: "hidden" }}>
              {user.photoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${user.photoId}`} alt={`${displayName} profile photo`} width={34} height={34} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="ds-userpill-name">{displayName}</span>
            <Icon name="down" size={15} />
          </button>

          {userOpen && (
            <div className="ds-menu ds-user-menu" role="menu">
              <div className="ds-user-head">
                <span className="ds-avatar" style={{ width: 42, height: 42, fontSize: 15 }}>
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{displayName}</strong>
                  <small>{user.email ?? "Smart ID session"}</small>
                  <span className="ds-role">{roleDisplay}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserOpen(false);
                  onOpenAccount?.();
                }}
                className="ds-menu-item"
              >
                <span>
                  <Icon name="user" size={17} />
                </span>
                <span className="ds-label">Account &amp; preferences</span>
              </button>
              <div className="ds-menu-sep" />
              <button type="button" onClick={handleLogout} className="ds-menu-item danger">
                <span>
                  <Icon name="signout" size={17} />
                </span>
                <span className="ds-label">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
