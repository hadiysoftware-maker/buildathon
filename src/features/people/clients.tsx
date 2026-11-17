"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EntityManager, type FieldDef } from "@/components/dashboard/EntityManager";
import { PillChip, Sheet, Field } from "@/components/dashboard/Kit";
import { M3Select } from "@/components/ui/M3Select";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { CardSheet } from "@/components/smart-id/CardSheet";
import { downloadBlob } from "@/lib/card-pdf";
import { toCsv } from "@/lib/csv";
import type { CardView } from "@/features/smart-id/card";
import type { FormValues } from "@/features/types";
import * as P from "./actions";

type Opt = { value: string; label: string };
type Status = "ACTIVE" | "INACTIVE" | "ARCHIVED";

const statusTone = (s: string) => (s === "ACTIVE" ? "ok" : s === "INACTIVE" ? "warn" : "neutral");

/** Hidden file input + button that reads a CSV in the browser and hands the text to a Server Action. */
function CsvImport({ run, label }: { run: (csv: string) => Promise<{ ok: true; data: P.ImportSummary } | { ok: false; error: string }>; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1_000_000) return void toast.error("CSV is too large (limit 1 MB).");
    start(async () => {
      const r = await run(await f.text());
      if (!r.ok) return void toast.error(r.error);
      const { created, errors } = r.data;
      if (errors.length) toast.error(`Imported ${created}. ${errors.length} row(s) failed, first: row ${errors[0].row} — ${errors[0].message}`);
      else toast.success(`Imported ${created} ${label}`);
      router.refresh();
    });
    if (ref.current) ref.current.value = "";
  };
  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" className="ds-btn outline sm" disabled={pending} onClick={() => ref.current?.click()}>
        <Icon name="fileImport" size={16} /> {pending ? "Importing…" : "Import CSV"}
      </button>
    </>
  );
}

function exportCsv(name: string, header: string[], rows: (string | number | null | undefined)[][]) {
  downloadBlob(new TextEncoder().encode(toCsv([header, ...rows])), name, "text/csv;charset=utf-8");
}

// ── Students ────────────────────────────────────────────────────
export interface StudentRow {
  id: string; // userId
  name: string;
  studentCode: string;
  admissionNumber: string;
  email: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelation: string | null;
  dateOfBirth: string;
  departmentId: string | null;
  courseId: string | null;
  department: string | null;
  classLabel: string | null;
  status: Status;
  cardStatus: string | null;
}

export function StudentsManager({ rows, departments, courses, divisions }: { rows: StudentRow[]; departments: Opt[]; courses: Opt[]; divisions: Opt[] }) {
  const router = useRouter();
  const [cards, setCards] = useState<CardView[]>([]);
  const [transfer, setTransfer] = useState<StudentRow | null>(null);
  const [target, setTarget] = useState("");
  const [pending, start] = useTransition();
  const none = (o: Opt[]) => [{ value: "", label: "— None —" }, ...o];

  const fields: FieldDef[] = [
    { name: "fullName", label: "Full name", required: true },
    { name: "email", label: "Email", type: "email", hint: "Optional. Students sign in with their Smart ID, not email." },
    { name: "phone", label: "Phone" },
    { name: "dateOfBirth", label: "Date of birth", type: "date" },
    { name: "guardianName", label: "Guardian name" },
    { name: "guardianPhone", label: "Guardian phone" },
    { name: "guardianRelation", label: "Guardian relation" },
    { name: "departmentId", label: "Department", type: "select", options: none(departments) },
    { name: "courseId", label: "Course", type: "select", options: none(courses) },
    { name: "divisionId", label: "Class division", type: "select", options: none(divisions), createOnly: true },
    { name: "rollNumber", label: "Roll number", type: "number", createOnly: true, hint: "Leave blank for the next free number." },
    { name: "issueCard", label: "Issue Smart ID card now", type: "checkbox", createOnly: true, defaultValue: "true" },
  ];

  const doTransfer = () =>
    start(async () => {
      if (!transfer) return;
      const r = await P.transferStudent(transfer.id, target);
      if (r.ok) { toast.success("Student transferred"); setTransfer(null); router.refresh(); } else toast.error(r.error);
    });

  const toggle = (row: StudentRow) =>
    start(async () => {
      const r = await P.setStudentStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      if (r.ok) router.refresh(); else toast.error(r.error);
    });

  return (
    <>
      <EntityManager<StudentRow>
        eyebrow="People" title="Students" noun="Student"
        description="Admissions, enrollment and Smart ID cards. Students sign in by scanning their card; there are no passwords."
        rows={rows}
        searchText={(r) => `${r.name} ${r.studentCode} ${r.admissionNumber} ${r.classLabel ?? ""}`}
        columns={[
          { key: "name", label: "Student", render: (r) => <span><Link href={`/admin/people/students/${r.id}`}><strong>{r.name}</strong></Link><br /><small className="cd-muted">{r.studentCode}</small></span> },
          { key: "class", label: "Class", render: (r) => r.classLabel ?? <span className="cd-muted">Not enrolled</span> },
          { key: "dept", label: "Department", render: (r) => r.department ?? "—" },
          { key: "card", label: "Smart ID", render: (r) => (r.cardStatus ? <PillChip tone={r.cardStatus === "ACTIVE" ? "ok" : r.cardStatus === "SUSPENDED" ? "warn" : "bad"}>{r.cardStatus.toLowerCase()}</PillChip> : <PillChip tone="neutral">none</PillChip>) },
          { key: "status", label: "Status", render: (r) => <PillChip tone={statusTone(r.status)}>{r.status.toLowerCase()}</PillChip> },
        ]}
        fields={fields}
        toForm={(r) => ({ fullName: r.name, email: r.email ?? "", phone: r.phone ?? "", dateOfBirth: r.dateOfBirth, guardianName: r.guardianName ?? "", guardianPhone: r.guardianPhone ?? "", guardianRelation: r.guardianRelation ?? "", departmentId: r.departmentId ?? "", courseId: r.courseId ?? "" })}
        onCreate={async (v: FormValues) => {
          const r = await P.createStudent(v);
          if (r.ok && r.data.card) setCards([r.data.card]);
          return r;
        }}
        onUpdate={P.updateStudent}
        onArchive={(id) => P.setStudentStatus(id, "ARCHIVED")}
        headerActions={
          <>
            <CsvImport run={P.importStudentsCsv} label="students" />
            <button type="button" className="ds-btn outline sm" onClick={() => exportCsv("students.csv", ["Full name", "Student code", "Admission number", "Class", "Department", "Email", "Phone", "Status"], rows.map((r) => [r.name, r.studentCode, r.admissionNumber, r.classLabel, r.department, r.email, r.phone, r.status]))}>
              <Icon name="fileExport" size={16} /> Export CSV
            </button>
          </>
        }
        renderRowActions={(r) => (
          <>
            <button type="button" className="dk-icon-btn" aria-label="Transfer student" title="Transfer to another division" onClick={() => { setTarget(""); setTransfer(r); }}>
              <Icon name="refresh" size={16} />
            </button>
            {r.status !== "ARCHIVED" && (
              <button type="button" className="dk-icon-btn" aria-label={r.status === "ACTIVE" ? "Deactivate student" : "Reactivate student"} title={r.status === "ACTIVE" ? "Deactivate" : "Reactivate"} disabled={pending} onClick={() => toggle(r)}>
                <Icon name={r.status === "ACTIVE" ? "userMinus" : "userCheck"} size={16} />
              </button>
            )}
          </>
        )}
      />
      <CardSheet cards={cards} onClose={() => setCards([])} />
      <Sheet
        open={!!transfer}
        onClose={() => setTransfer(null)}
        title="Transfer student"
        subtitle={transfer?.name}
        footer={<><button type="button" className="ds-btn outline sm" onClick={() => setTransfer(null)}>Cancel</button><button type="button" className="ds-btn sm" disabled={!target || pending} onClick={doTransfer}>Transfer</button></>}
      >
        <Field label="New division" required hint="The previous enrollment is kept as history."><M3Select value={target} onChange={setTarget} options={divisions} placeholder="Choose division" /></Field>
      </Sheet>
    </>
  );
}

// ── Teachers ────────────────────────────────────────────────────
export interface TeacherRow {
  id: string;
  name: string;
  teacherCode: string;
  employeeId: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  department: string | null;
  qualification: string | null;
  designation: string | null;
  specialization: string | null;
  status: Status;
  cardStatus: string | null;
}

export function TeachersManager({ rows, departments }: { rows: TeacherRow[]; departments: Opt[] }) {
  const router = useRouter();
  const [cards, setCards] = useState<CardView[]>([]);
  const [pending, start] = useTransition();
  const toggle = (row: TeacherRow) =>
    start(async () => {
      const r = await P.setTeacherStatus(row.id, row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      if (r.ok) router.refresh(); else toast.error(r.error);
    });
  return (
    <>
      <EntityManager<TeacherRow>
        eyebrow="People" title="Teachers" noun="Teacher"
        description="Faculty records and Smart ID cards. Teachers sign in by scanning their card."
        rows={rows}
        searchText={(r) => `${r.name} ${r.teacherCode} ${r.employeeId} ${r.department ?? ""}`}
        columns={[
          { key: "name", label: "Teacher", render: (r) => <span><strong>{r.name}</strong><br /><small className="cd-muted">{r.teacherCode}</small></span> },
          { key: "emp", label: "Employee ID", render: (r) => r.employeeId },
          { key: "dept", label: "Department", render: (r) => r.department ?? "—" },
          { key: "desig", label: "Designation", render: (r) => r.designation ?? "—" },
          { key: "card", label: "Smart ID", render: (r) => (r.cardStatus ? <PillChip tone={r.cardStatus === "ACTIVE" ? "ok" : r.cardStatus === "SUSPENDED" ? "warn" : "bad"}>{r.cardStatus.toLowerCase()}</PillChip> : <PillChip tone="neutral">none</PillChip>) },
          { key: "status", label: "Status", render: (r) => <PillChip tone={statusTone(r.status)}>{r.status.toLowerCase()}</PillChip> },
        ]}
        fields={[
          { name: "fullName", label: "Full name", required: true },
          { name: "employeeId", label: "Employee ID", required: true, createOnly: true },
          { name: "email", label: "Email", type: "email" },
          { name: "phone", label: "Phone" },
          { name: "departmentId", label: "Department", type: "select", options: [{ value: "", label: "— None —" }, ...departments] },
          { name: "designation", label: "Designation" },
          { name: "qualification", label: "Qualification" },
          { name: "specialization", label: "Specialization" },
          { name: "issueCard", label: "Issue Smart ID card now", type: "checkbox", createOnly: true, defaultValue: "true" },
        ]}
        toForm={(r) => ({ fullName: r.name, email: r.email ?? "", phone: r.phone ?? "", departmentId: r.departmentId ?? "", designation: r.designation ?? "", qualification: r.qualification ?? "", specialization: r.specialization ?? "" })}
        onCreate={async (v: FormValues) => {
          const r = await P.createTeacher(v);
          if (r.ok && r.data.card) setCards([r.data.card]);
          return r;
        }}
        onUpdate={P.updateTeacher}
        onArchive={(id) => P.setTeacherStatus(id, "ARCHIVED")}
        headerActions={
          <>
            <CsvImport run={P.importTeachersCsv} label="teachers" />
            <button type="button" className="ds-btn outline sm" onClick={() => exportCsv("teachers.csv", ["Full name", "Teacher code", "Employee ID", "Department", "Designation", "Email", "Phone", "Status"], rows.map((r) => [r.name, r.teacherCode, r.employeeId, r.department, r.designation, r.email, r.phone, r.status]))}>
              <Icon name="fileExport" size={16} /> Export CSV
            </button>
          </>
        }
        renderRowActions={(r) =>
          r.status !== "ARCHIVED" ? (
            <button type="button" className="dk-icon-btn" aria-label={r.status === "ACTIVE" ? "Deactivate teacher" : "Reactivate teacher"} disabled={pending} onClick={() => toggle(r)}>
              <Icon name={r.status === "ACTIVE" ? "userMinus" : "userCheck"} size={16} />
            </button>
          ) : null
        }
      />
      <CardSheet cards={cards} onClose={() => setCards([])} />
    </>
  );
}
