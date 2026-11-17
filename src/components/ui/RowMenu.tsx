"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { Presence } from "./Presence";

export interface RowAction {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onClick: () => void;
}

export function RowMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      } else if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", on);
    document.addEventListener("keydown", on);
    return () => {
      document.removeEventListener("mousedown", on);
      document.removeEventListener("keydown", on);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div ref={ref} className="rowmenu">
      <button
        type="button"
        className="icon-btn"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" size={18} />
      </button>
      <Presence show={open} variant="menu">
        <div className="menu-surface rowmenu-list" role="menu">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              className={`menu-item${a.danger ? " danger" : ""}`}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
            >
              {a.icon && <Icon name={a.icon} size={16} />}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </Presence>
    </div>
  );
}
