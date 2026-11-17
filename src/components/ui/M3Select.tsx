"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Presence } from "./Presence";

export interface M3SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function M3Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: M3SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const [dropUp, setDropUp] = useState(false);
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      setDropUp(below < 260 && r.top > below);
      setCoords({ left: r.left, top: r.top, bottom: r.bottom, width: r.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value && !o.disabled)));
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, options, value]);

  const move = (delta: number) => {
    let i = active;
    for (let n = 0; n < options.length; n++) {
      i = (i + delta + options.length) % options.length;
      if (!options[i].disabled) {
        setActive(i);
        return;
      }
    }
  };

  return (
    <div ref={wrapRef} className={`select${className ? ` ${className}` : ""}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        className="select-field"
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
            return;
          }
          if (!open) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const opt = options[active];
            if (opt && !opt.disabled) {
              onChange(opt.value);
              setOpen(false);
            }
          }
        }}
      >
        <span className={selected ? undefined : "select-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="select-arrow" data-open={open}>
          <Icon name="down" size={16} />
        </span>
      </button>

      {/* Rendered in document.body: inside a sheet or dialog (transformed ancestors) a fixed menu would be offset. */}
      {typeof document !== "undefined" && createPortal(
      <Presence show={open && !!coords} variant="menu">
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          className="select-menu"
          style={
            coords
              ? {
                left: Math.min(coords.left, Math.max(8, window.innerWidth - Math.max(coords.width, 180) - 8)),
                width: Math.max(coords.width, 180),
                ...(dropUp ? { bottom: window.innerHeight - coords.top + 4 } : { top: coords.bottom + 4 }),
              }
              : undefined
          }
        >
          <ul className="select-list">
            {options.map((opt, idx) => {
              const isSel = opt.value === value;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={opt.disabled}
                  className={`select-option${idx === active ? " active" : ""}`}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {isSel ? <Icon name="check" size={16} /> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </Presence>,
      document.body)}
    </div>
  );
}
