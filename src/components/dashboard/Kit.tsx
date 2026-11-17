"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Search, Upload, X } from "@/components/HugeIcon";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Presence } from "@/components/ui/Presence";
import { EmptyState } from "@/components/ui/EmptyState";
import { M3Select } from "@/components/ui/M3Select";

export function PageHeader({
  title,
  description,
  subtitle,
  eyebrow,
  back,
  actions,
  right,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  back?: string;
  actions?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const descNode = description ?? subtitle;
  const actionsNode = actions ?? right;
  return (
    <header className="dk-head">
      <div className="dk-head-row">
        {back && (
          <Link href={back} className="dk-back" aria-label="Back">
            <ArrowLeft />
          </Link>
        )}
        <div className="dk-head-copy">
          {eyebrow && <p className="dk-eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {descNode && <p className="dk-desc">{descNode}</p>}
        </div>
        {actionsNode && <div className="dk-head-actions">{actionsNode}</div>}
      </div>
    </header>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="dk-toolbar">{children}</div>;
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`dk-search ${className}`.trim()} style={{ height: "44px", minHeight: "44px", maxHeight: "44px" }}>
      <Search />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search">
          <X />
        </button>
      )}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
}) {
  return (
    <div className="dk-seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {typeof o.count === "number" && <b>{o.count}</b>}
        </button>
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: React.ReactNode;
  align?: "left" | "right";
  hideOnMobile?: boolean;
  render: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: { title: string; text: string };
  onRowClick?: (row: T) => void;
}) {
  if (loading) {
    return (
      <div className="dk-skel">
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState mood="sleepy" prop="search" title={empty?.title || "Nothing here yet"}>
        {empty?.text}
      </EmptyState>
    );
  }
  return (
    <div className="dk-table-wrap">
      <table className="dk-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.hideOnMobile ? "dk-hide-sm" : undefined}
                style={c.align === "right" ? { textAlign: "right" } : undefined}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              className={onRowClick ? "dk-click" : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={c.hideOnMobile ? "dk-hide-sm" : undefined}
                  style={c.align === "right" ? { textAlign: "right" } : undefined}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
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

  const content = (
    <Presence show={open} variant="dialog">
      <div
        className="dk-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={`dk-sheet ${size}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dk-sheet-head">
            <div>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="dk-x" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>
          <div className="dk-sheet-body">{children}</div>
          {footer && <div className="dk-sheet-foot">{footer}</div>}
        </div>
      </div>
    </Presence>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

export function Field({
  label,
  hint,
  error,
  required,
  className = "",
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`dk-field ${className}`.trim()}>
      <span>
        {label}
        {required && <span className="ml-0.5 text-[#9E2A2B]" aria-hidden="true">*</span>}
      </span>
      {children}
      {error ? (
        <small className="!text-[#9E2A2B] font-medium">{error}</small>
      ) : (
        hint && <small>{hint}</small>
      )}
    </label>
  );
}

export function DropZone({
  accept,
  fileName,
  onFile,
  hint = "Drop an .xlsx or .csv file here, or click to choose",
}: {
  accept?: string;
  fileName?: string;
  onFile: (file: File) => void;
  hint?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dk-drop${over ? " over" : ""}${fileName ? " has" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <span className="dk-drop-ic">
        <Upload />
      </span>
      <b>{fileName || "Choose a file"}</b>
      <small>{hint}</small>
    </div>
  );
}

/**
 * Page container wrap providing consistent spacing and overflow containment.
 */
export function PageWrap({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`cd-page ${className}`.trim()}>{children}</div>;
}

/**
 * Minimal Section card matching `X:\fest-ms` `.cd-card` with tonal header & body padding.
 */
export function SectionCard({
  title,
  subtitle,
  description,
  icon,
  count,
  actions,
  right,
  action,
  children,
  className = "",
  noPadding = false,
  flush = false,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode | React.ElementType | IconName;
  count?: number;
  actions?: React.ReactNode;
  right?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  flush?: boolean;
}) {
  const iconNode = (() => {
    if (!icon) return null;
    if (typeof icon === "string") return <Icon name={icon as IconName} size={18} />;
    if (
      typeof icon === "function" ||
      (typeof icon === "object" && icon !== null && !("props" in (icon as any)))
    ) {
      const IconComp = icon as React.ElementType;
      return <IconComp />;
    }
    return icon as React.ReactNode;
  })();

  const subNode = subtitle ?? description;
  const actionsNode = actions ?? right ?? action;
  const hasHeader = !!(title || subNode || iconNode || actionsNode || typeof count === "number");

  return (
    <section className={`cd-card ${className}`.trim()}>
      {hasHeader && (
        <header>
          {iconNode && <span className="cd-head-ic">{iconNode}</span>}
          <div className="min-w-0 flex-1">
            {title && <h3>{title}</h3>}
            {subNode && <p>{subNode}</p>}
          </div>
          <div className="cd-row">
            {typeof count === "number" && <span className="ds-count">{count}</span>}
            {actionsNode}
          </div>
        </header>
      )}
      <div className={noPadding || flush ? "min-w-0" : "cd-body"}>{children}</div>
    </section>
  );
}

/**
 * Profile/Detail hero card with large avatar/monogram, subtitle pills, and responsive wrapping actions.
 */
export function EntityHero({
  avatar,
  initials,
  avatarUrl,
  title,
  name,
  subtitle,
  badges,
  chips,
  metrics,
  meta,
  actions,
  className = "",
}: {
  avatar?: React.ReactNode;
  initials?: React.ReactNode;
  avatarUrl?: string | null;
  title?: React.ReactNode;
  name?: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  chips?: { label: React.ReactNode; tone?: ChipTone }[];
  metrics?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const avNode = avatar ?? initials;
  const titleNode = title ?? name;
  const metricsNode = metrics ?? meta;
  const badgesNode =
    badges ??
    (chips && chips.length > 0 ? (
      <>
        {chips.map((c, i) => (
          <PillChip key={i} tone={c.tone}>
            {c.label}
          </PillChip>
        ))}
      </>
    ) : null);

  return (
    <div className={`cd-hero ${className}`.trim()}>
      <div className="cd-hero-id">
        <div className="cd-av is-lg">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
          ) : (
            avNode
          )}
        </div>
        <div className="cd-hero-copy">
          <div className="flex flex-wrap items-center gap-2">
            <h2>{titleNode}</h2>
            {badgesNode}
          </div>
          {subtitle && <p>{subtitle}</p>}
          {metricsNode && <div className="cd-views mt-3">{metricsNode}</div>}
        </div>
      </div>
      {actions && <div className="cd-actions">{actions}</div>}
    </div>
  );
}

/**
 * Key-value tonal tile grid matching `fest-ms` `.cd-kv`.
 */
export function KvGrid({
  items,
}: {
  items: { label: React.ReactNode; value: React.ReactNode }[];
}) {
  return (
    <dl className="cd-kv">
      {items.map((item, idx) => (
        <div key={idx}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type ChipTone =
  | "neutral"
  | "dark"
  | "khaki"
  | "ok"
  | "bad"
  | "warn"
  | "accent"
  | "brand"
  | "danger";

/**
 * Monochrome status pill chip (`.cd-chip`).
 */
export function PillChip({
  tone = "neutral",
  title,
  className = "",
  children,
}: {
  tone?: ChipTone;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const normalizedTone =
    tone === "accent" || tone === "brand"
      ? "dark"
      : tone === "danger"
      ? "bad"
      : tone;
  return (
    <span
      className={`cd-chip ${className}`.trim()}
      title={title}
      data-tone={normalizedTone !== "neutral" ? normalizedTone : undefined}
    >
      {children}
    </span>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Themed dropdown selector (custom `M3Select`; no third-party select dependency). */
export function ResponsiveSelect({
  value,
  onChange,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  ariaLabel,
  id,
}: {
  value: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  id?: string;
}) {
  return (
    <div className={className ? `w-full min-w-0 ${className}` : "w-full min-w-0"}>
      <M3Select
        id={id}
        value={value ?? ""}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(next) => {
          if (next !== (value ?? "")) (onChange ?? onValueChange)?.(next);
        }}
      />
    </div>
  );
}

function cnSelectDesktop(extra?: string) {
  return extra ? `w-full ${extra}` : "w-full";
}



