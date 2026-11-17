"use client";

import { Download, FileText, Check, X, RefreshCw } from "@/components/HugeIcon";
import { PageHeader } from "@/components/dashboard/Kit";
import { SettingsDialog } from "@/components/dashboard/Forms";
import { EmptyState } from "@/components/ui/EmptyState";

export function ReportHeader({
  eyebrow = "Reports",
  back = "/reports",
  title,
  description,
  subtitle,
  onExport,
  onRefresh,
  loading,
  actions,
}: {
  eyebrow?: React.ReactNode;
  back?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  subtitle?: React.ReactNode;
  onExport?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <PageHeader
      back={back}
      eyebrow={
        <>
          {eyebrow}
          {subtitle ? ` · ${subtitle}` : ""}
        </>
      }
      title={title}
      description={description}
      actions={
        <>
          {actions}
          {onRefresh && (
            <button type="button" className="ds-icon-btn" onClick={onRefresh} aria-label="Refresh" title="Refresh">
              <RefreshCw style={{ width: 16, height: 16, animation: loading ? "spin 1s linear infinite" : undefined }} />
            </button>
          )}
          {onExport && (
            <button type="button" className="ds-btn sm" onClick={onExport}>
              <Download /> Export
            </button>
          )}
        </>
      }
    />
  );
}

export type ExportField = { key: string; label: string };

export function ExportDialog({
  open,
  onClose,
  title = "Export report",
  fields,
  values,
  onChange,
  onExcel,
  onPdf,
  note,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  fields: ExportField[];
  values: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
  onExcel?: () => void;
  onPdf?: () => void;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const all = fields.every((f) => values[f.key]);
  const chosen = fields.filter((f) => values[f.key]).length;
  return (
    <SettingsDialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={note || `${chosen} of ${fields.length} columns selected`}
      width={560}
      footer={
        <>
          <button type="button" className="ds-btn outline sm" onClick={onClose}>
            Cancel
          </button>
          {onExcel && (
            <button type="button" className="ds-btn tonal sm" onClick={onExcel}>
              <Download /> Excel
            </button>
          )}
          {onPdf && (
            <button type="button" className="ds-btn sm" onClick={onPdf}>
              <FileText /> PDF
            </button>
          )}
        </>
      }
    >
      {children}
      <div className="rp-fields-head">
        <b>Columns</b>
        <button type="button" onClick={() => fields.forEach((f) => onChange(f.key, !all))}>
          {all ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="rp-fields">
        {fields.map((f) => (
          <div
            key={f.key}
            onClick={() => onChange(f.key, !values[f.key])}
            className={`flex items-center gap-2 cursor-pointer ${values[f.key] ? "is-on" : ""}`}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={Boolean(values[f.key])}
                onChange={(e) => onChange(f.key, e.target.checked)}
              />
            </div>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </SettingsDialog>
  );
}

export function SelectionBar({
  count,
  onExport,
  onClear,
  children,
}: {
  count: number;
  onExport?: () => void;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  if (count <= 0) return null;
  return (
    <div className="rp-selbar" role="status">
      <span>
        <b>{count}</b> selected
      </span>
      {children}
      {onExport && (
        <button type="button" onClick={onExport}>
          <Download /> Export
        </button>
      )}
      <button type="button" onClick={onClear}>
        <X /> Clear
      </button>
    </div>
  );
}

export function ReportEmpty({ title = "Nothing to show", text }: { title?: string; text?: React.ReactNode }) {
  return (
    <EmptyState mood="sleepy" prop="search" title={title}>
      {text || "Try another filter or search."}
    </EmptyState>
  );
}

