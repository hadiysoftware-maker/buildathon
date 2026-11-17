"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Presence } from "./Presence";

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export interface SortOption {
  value: string;
  label: string;
}

export function FilterBar({
  filters = [],
  sorts,
  sort,
  onSort,
  onClear,
}: {
  filters?: FilterGroup[];
  sorts?: SortOption[];
  sort?: string;
  onSort?: (value: string) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState<"filter" | "sort" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(null);
      } else if (!ref.current?.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener("mousedown", on);
    document.addEventListener("keydown", on);
    return () => {
      document.removeEventListener("mousedown", on);
      document.removeEventListener("keydown", on);
    };
  }, [open]);

  const activeFilters = filters.filter((f) => f.value && f.value !== "all").length;
  const sortLabel = sorts?.find((s) => s.value === sort)?.label;

  return (
    <div ref={ref} className="filterbar">
      {filters.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className={`btn tonal sm`}
            onClick={() => setOpen((o) => (o === "filter" ? null : "filter"))}
            aria-expanded={open === "filter"}
          >
            <Icon name="filter" size={16} />
            Filter{activeFilters ? ` (${activeFilters})` : ""}
          </button>
          <Presence show={open === "filter"} variant="menu">
            <div className="menu-surface filter-menu" style={{ right: 0, top: "calc(100% + 6px)" }}>
              {filters.map((f) => (
                <div key={f.key} className="filter-group">
                  <div className="filter-label">{f.label}</div>
                  <div className="filter-chips">
                    {f.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className="tab"
                        aria-pressed={f.value === o.value}
                        onClick={() => f.onChange(o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {activeFilters > 0 && onClear && (
                <div className="pt-2 border-t border-[var(--md-outline-variant)] flex justify-end">
                  <button
                    type="button"
                    className="btn text sm"
                    onClick={() => {
                      onClear();
                      setOpen(null);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </Presence>
        </div>
      )}

      {sorts && sorts.length > 0 && onSort && (
        <div className="relative">
          <button
            type="button"
            className="btn outlined sm"
            onClick={() => setOpen((o) => (o === "sort" ? null : "sort"))}
            aria-expanded={open === "sort"}
          >
            <Icon name="sort" size={16} />
            {sortLabel ?? "Sort"}
          </button>
          <Presence show={open === "sort"} variant="menu">
            <div className="menu-surface" style={{ right: 0, top: "calc(100% + 6px)", minWidth: 190 }}>
              {sorts.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    onSort(s.value);
                    setOpen(null);
                  }}
                >
                  <span className="radio-dot" data-on={sort === s.value} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                </button>
              ))}
            </div>
          </Presence>
        </div>
      )}
    </div>
  );
}
