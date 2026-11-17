"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Minus, Plus, X } from "@/components/HugeIcon";
import { Presence } from "@/components/ui/Presence";

export type DialogTab = { id: string; label: React.ReactNode; icon?: React.ReactNode };

export function SettingsDialog({
  open,
  onClose,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  width = 720,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tabs?: DialogTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hasNav = Boolean(tabs && tabs.length > 0);
  const dialogTree = (
    <Presence show={open} variant="dialog">
      <div
        className="dk2-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="dk2-dialog"
          style={{ ["--w" as string]: `${width}px` }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dk2-dialog-head">
            <div>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="dk2-x" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>
          <div className={`dk2-dialog-main${hasNav ? " has-nav" : ""}`}>
            {hasNav && (
              <nav className="dk2-nav" aria-label="Dialog sections">
                {tabs!.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={activeTab === t.id ? "true" : undefined}
                    onClick={() => onTabChange?.(t.id)}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </nav>
            )}
            <div className="dk2-pane">{children}</div>
          </div>
          {footer && <div className="dk2-dialog-foot">{footer}</div>}
        </div>
      </div>
    </Presence>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(dialogTree, document.body);
}

export function SettingGroup({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="dk2-group">
      {title && <h3>{title}</h3>}
      <div className="dk2-rows">{children}</div>
    </section>
  );
}

export function SettingRow({
  title,
  hint,
  stacked,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  stacked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`dk2-row${stacked ? " stacked" : ""}`}>
      <div className="dk2-row-copy">
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </div>
      {children && <div className="dk2-row-ctl">{children}</div>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="dk2-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  return (
    <div className="dk2-stepper">
      <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={label ? `Decrease ${label}` : "Decrease"}>
        <Minus />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      {unit && <span>{unit}</span>}
      <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={label ? `Increase ${label}` : "Increase"}>
        <Plus />
      </button>
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="dk2-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ ["--p" as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <b>
        {value}
        {unit}
      </b>
    </div>
  );
}

export function MasterDetail({
  list,
  detail,
  hasSelection,
  onBack,
  backLabel = "All items",
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  hasSelection: boolean;
  onBack: () => void;
  backLabel?: string;
}) {
  const [showDetail, setShowDetail] = useState(hasSelection);
  useEffect(() => {
    setShowDetail(hasSelection);
  }, [hasSelection]);

  return (
    <div className={`dk2-md${showDetail ? " show-detail" : ""}`}>
      <aside className="dk2-md-list">{list}</aside>
      <section className="dk2-md-detail">
        <div className="md:hidden">
          <button
            type="button"
            className="ds-btn outline sm"
            onClick={() => {
              setShowDetail(false);
              onBack();
            }}
          >
            <ChevronLeft /> {backLabel}
          </button>
        </div>
        {detail}
      </section>
    </div>
  );
}

export function ListCard({
  active,
  onClick,
  title,
  sub,
  badge,
  meta,
}: {
  active?: boolean;
  onClick: () => void;
  title: React.ReactNode;
  sub?: React.ReactNode;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="dk2-lc"
      aria-current={active ? "true" : undefined}
      onClick={onClick}
    >
      <div className="dk2-lc-main">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </div>
      {(badge || meta) && (
        <div className="dk2-lc-side">
          {badge}
          {meta && <em>{meta}</em>}
        </div>
      )}
    </button>
  );
}

export function StatusChip({
  tone = "neutral",
  children,
}: {
  tone?: "dark" | "red" | "green" | "gold" | "neutral";
  children: React.ReactNode;
}) {
  return <span className={`dk2-chip${tone !== "neutral" ? ` t-${tone}` : ""}`}>{children}</span>;
}

