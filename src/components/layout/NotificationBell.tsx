"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  type: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
function ago(iso: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (!rtf) return "";
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffMin) < 1440) return rtf.format(Math.round(diffMin / 60), "hour");
  return rtf.format(Math.round(diffMin / 1440), "day");
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } catch {
      /* transient network error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    const res = await fetch("/api/notifications", { method: "PATCH" }).catch(() => null);
    if (res?.ok) {
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    }
  };

  const markRead = async (id: string) => {
    const res = await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => null);
    if (res?.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((u) => Math.max(0, u - 1));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        data-open={open ? "true" : undefined}
        className="ds-bell"
      >
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="ds-bell-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="ds-notif-menu fixed right-3 top-16 sm:absolute sm:right-0 sm:top-full sm:mt-2"
        >
          <div className="ds-notif-head">
            <div>
              <strong>Notifications</strong>
              <small>{unread > 0 ? `${unread} unread` : "All caught up"}</small>
            </div>
            <div className="ds-notif-actions">
              {unread > 0 && (
                <button type="button" onClick={markAllRead} title="Mark all as read" aria-label="Mark all as read">
                  <Icon name="checkDouble" size={17} />
                </button>
              )}
              <button type="button" onClick={load} title="Refresh" aria-label="Refresh notifications">
                <Icon name="refresh" size={17} />
              </button>
            </div>
          </div>
          <ul className="ds-notif-list">
            {loading && items.length === 0 ? (
              <li className="py-8 text-center text-xs">Loading notifications…</li>
            ) : items.length === 0 ? (
              <li className="py-8 text-center text-xs">You’re all caught up.</li>
            ) : (
              items.slice(0, 15).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.readAt) void markRead(n.id);
                      if (n.link) window.location.assign(n.link);
                    }}
                    className={`ds-notif-item${n.readAt ? "" : " unread"}`}
                  >
                    <span className="ds-tile" style={{ width: 40, height: 40 }}>
                      <Icon name="bell" size={16} />
                    </span>
                    <span className="ds-notif-text">
                      <strong>{n.title}</strong>
                      {n.body && <span>{n.body}</span>}
                      <small>{ago(n.createdAt)}</small>
                    </span>
                    {!n.readAt && <span className="ds-notif-dot" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
