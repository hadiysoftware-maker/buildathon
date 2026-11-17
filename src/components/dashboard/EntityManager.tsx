"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable, Field, PageHeader, PageWrap, SearchBox, Sheet, Toolbar, type Column } from "@/components/dashboard/Kit";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { M3Select } from "@/components/ui/M3Select";
import { toast } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";
import type { ActionResult, FormValues } from "@/features/types";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "email" | "select" | "checkbox" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Only shown when creating (e.g. immutable codes). */
  createOnly?: boolean;
}

interface Props<T extends { id: string }> {
  title: string;
  description: string;
  eyebrow?: string;
  noun: string;
  rows: T[];
  columns: Column<T>[];
  fields: FieldDef[];
  searchText: (row: T) => string;
  onCreate: (v: FormValues) => Promise<ActionResult<unknown>>;
  onUpdate?: (id: string, v: FormValues) => Promise<ActionResult<unknown>>;
  toForm?: (row: T) => FormValues;
  onArchive?: (id: string) => Promise<ActionResult<unknown>>;
  emptyText?: string;
  headerActions?: React.ReactNode;
  /** Extra per-row controls (rendered next to edit/archive). */
  renderRowActions?: (row: T) => React.ReactNode;
  /** Wording for the removal action, e.g. "Remove" for hard deletes of link rows. Default "Archive". */
  archiveVerb?: string;
  /** Hide the "New" button (read-only lists). */
  hideCreate?: boolean;
}

/** Generic list + create/edit sheet + archive confirm, built on the dashboard kit. Used by the academic pages. */
export function EntityManager<T extends { id: string }>(p: Props<T>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [archiving, setArchiving] = useState<T | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? p.rows.filter((r) => p.searchText(r).toLowerCase().includes(s)) : p.rows;
  }, [p, q]);

  const openNew = () => {
    const init: FormValues = {};
    for (const f of p.fields) init[f.name] = f.defaultValue ?? "";
    setValues(init);
    setEditing("new");
  };
  const openEdit = (row: T) => {
    setValues(p.toForm ? p.toForm(row) : {});
    setEditing(row);
  };

  const submit = () => {
    const isNew = editing === "new";
    const run = isNew ? p.onCreate(values) : p.onUpdate!((editing as T).id, values);
    start(async () => {
      const r = await run;
      if (r.ok) {
        toast.success(isNew ? `${p.noun} created` : `${p.noun} updated`);
        setEditing(null);
        router.refresh();
      } else toast.error(r.error);
    });
  };

  const columns: Column<T>[] = [
    ...p.columns,
    ...(p.onUpdate || p.onArchive || p.renderRowActions
      ? [
          {
            key: "_actions",
            label: "",
            align: "right" as const,
            render: (row: T) => (
              <span className="inline-flex gap-1">
                {p.renderRowActions?.(row)}
                {p.onUpdate && p.toForm && (
                  <button type="button" className="dk-icon-btn" aria-label={`Edit ${p.noun}`} onClick={() => openEdit(row)}>
                    <Icon name="edit" size={16} />
                  </button>
                )}
                {p.onArchive && (
                  <button type="button" className="dk-icon-btn" aria-label={`${verb} ${p.noun}`} onClick={() => setArchiving(row)}>
                    <Icon name="archive" size={16} />
                  </button>
                )}
              </span>
            ),
          },
        ]
      : []),
  ];

  const verb = p.archiveVerb ?? "Archive";
  const isNew = editing === "new";
  const visibleFields = p.fields.filter((f) => isNew || !f.createOnly);

  return (
    <PageWrap>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        actions={
          <>
            {p.headerActions}
            {!p.hideCreate && (
              <button type="button" className="ds-btn sm" onClick={openNew}>
                <Icon name="add" size={16} /> New {p.noun}
              </button>
            )}
          </>
        }
      />
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder={`Search ${p.title.toLowerCase()}…`} />
      </Toolbar>
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        empty={{ title: `No ${p.title.toLowerCase()} yet`, text: p.emptyText ?? `Create the first ${p.noun.toLowerCase()} to get started.` }}
      />

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={isNew ? `New ${p.noun}` : `Edit ${p.noun}`}
        footer={
          <>
            <button type="button" className="ds-btn outline sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="ds-btn sm" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          className="cd-grid"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {visibleFields.map((f) => (
            <Field key={f.name} label={f.label} hint={f.hint} required={f.required}>
              {f.type === "select" ? (
                <M3Select
                  value={values[f.name] ?? ""}
                  onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                  options={f.options ?? []}
                  placeholder={f.placeholder ?? "Select…"}
                />
              ) : f.type === "textarea" ? (
                <textarea value={values[f.name] ?? ""} onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))} />
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  style={{ width: 20, minHeight: 20 }}
                  checked={values[f.name] === "true"}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.checked ? "true" : "" }))}
                />
              ) : (
                <input
                  type={f.type ?? "text"}
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder}
                  required={f.required}
                  onChange={(e) => setValues((s) => ({ ...s, [f.name]: e.target.value }))}
                />
              )}
            </Field>
          ))}
          <button type="submit" hidden />
        </form>
      </Sheet>

      <ConfirmModal
        isOpen={archiving !== null}
        onClose={() => setArchiving(null)}
        title={`${verb} this ${p.noun.toLowerCase()}?`}
        description={verb === "Archive" ? "It will be hidden from new work, but its history is preserved." : "This removes the link. The people and subjects themselves are not deleted."}
        confirmText={verb}
        variant="warning"
        onConfirm={async () => {
          if (!archiving || !p.onArchive) return;
          const r = await p.onArchive(archiving.id);
          if (r.ok) {
            toast.success(`${p.noun} ${verb === "Archive" ? "archived" : "removed"}`);
            router.refresh();
          } else toast.error(r.error);
          setArchiving(null);
        }}
      />
    </PageWrap>
  );
}
