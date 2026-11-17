"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { EntityManager } from "@/components/dashboard/EntityManager";
import { PillChip } from "@/components/dashboard/Kit";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { fmtDate, toDateInput } from "@/lib/format";
import * as A from "./actions";

type Opt = { value: string; label: string };

// ── Academic years ──────────────────────────────────────────────
interface YearRow { id: string; name: string; startDate: Date; endDate: Date; status: "DRAFT" | "ACTIVE" | "ARCHIVED" }

export function YearsManager({ rows }: { rows: YearRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const activate = (id: string) =>
    start(async () => {
      const r = await A.activateAcademicYear(id);
      if (r.ok) { toast.success("Academic year activated"); router.refresh(); } else toast.error(r.error);
    });
  return (
    <EntityManager<YearRow>
      eyebrow="Academic management" title="Academic years" noun="Academic year"
      description="One year is active at a time. Activating a year archives the previous one; its records are kept."
      rows={rows}
      searchText={(r) => r.name}
      columns={[
        { key: "name", label: "Year", render: (r) => <strong>{r.name}</strong> },
        { key: "range", label: "Dates", render: (r) => `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}` },
        { key: "status", label: "Status", render: (r) => <PillChip tone={r.status === "ACTIVE" ? "ok" : r.status === "DRAFT" ? "warn" : "neutral"}>{r.status.toLowerCase()}</PillChip> },
      ]}
      fields={[
        { name: "name", label: "Name", required: true, placeholder: "2026–27" },
        { name: "startDate", label: "Starts", type: "date", required: true },
        { name: "endDate", label: "Ends", type: "date", required: true },
      ]}
      onCreate={A.createAcademicYear}
      onArchive={A.archiveAcademicYear}
      renderRowActions={(r) =>
        r.status !== "ACTIVE" && r.status !== "ARCHIVED" ? (
          <button type="button" className="ds-btn tonal sm" disabled={pending} onClick={() => activate(r.id)}>
            <Icon name="check" size={14} /> Activate
          </button>
        ) : r.status === "ARCHIVED" ? (
          <button type="button" className="ds-btn outline sm" disabled={pending} onClick={() => activate(r.id)}>Reactivate</button>
        ) : null
      }
    />
  );
}

// ── Departments ─────────────────────────────────────────────────
interface DeptRow { id: string; code: string; name: string; headTeacherId: string | null; headName: string | null; courses: number; teachers: number }

export function DepartmentsManager({ rows, teachers }: { rows: DeptRow[]; teachers: Opt[] }) {
  const head = [{ value: "", label: "— None —" }, ...teachers];
  return (
    <EntityManager<DeptRow>
      eyebrow="Academic management" title="Departments" noun="Department"
      description="Departments group courses, subjects and teachers."
      rows={rows}
      searchText={(r) => `${r.code} ${r.name}`}
      columns={[
        { key: "code", label: "Code", render: (r) => <PillChip tone="brand">{r.code}</PillChip> },
        { key: "name", label: "Name", render: (r) => <strong>{r.name}</strong> },
        { key: "head", label: "Head", hideOnMobile: true, render: (r) => r.headName ?? "—" },
        { key: "courses", label: "Courses", align: "right", render: (r) => r.courses },
        { key: "teachers", label: "Teachers", align: "right", hideOnMobile: true, render: (r) => r.teachers },
      ]}
      fields={[
        { name: "code", label: "Code", required: true, createOnly: true, placeholder: "CS" },
        { name: "name", label: "Name", required: true },
        { name: "headTeacherId", label: "Department head", type: "select", options: head },
      ]}
      toForm={(r) => ({ name: r.name, headTeacherId: r.headTeacherId ?? "" })}
      onCreate={A.createDepartment}
      onUpdate={A.updateDepartment}
      onArchive={A.archiveDepartment}
    />
  );
}

// ── Courses ─────────────────────────────────────────────────────
interface CourseRow { id: string; code: string; name: string; departmentId: string; departmentName: string; durationYears: number }

export function CoursesManager({ rows, departments }: { rows: CourseRow[]; departments: Opt[] }) {
  return (
    <EntityManager<CourseRow>
      eyebrow="Academic management" title="Courses" noun="Course"
      description="Programmes offered by each department."
      rows={rows}
      searchText={(r) => `${r.code} ${r.name} ${r.departmentName}`}
      columns={[
        { key: "code", label: "Code", render: (r) => <PillChip tone="brand">{r.code}</PillChip> },
        { key: "name", label: "Course", render: (r) => <Link href={`/admin/academic/courses/${r.id}`}><strong>{r.name}</strong></Link> },
        { key: "dept", label: "Department", hideOnMobile: true, render: (r) => r.departmentName },
        { key: "dur", label: "Years", align: "right", render: (r) => r.durationYears },
      ]}
      fields={[
        { name: "code", label: "Code", required: true, createOnly: true },
        { name: "name", label: "Name", required: true },
        { name: "departmentId", label: "Department", type: "select", options: departments, required: true },
        { name: "durationYears", label: "Duration (years)", type: "number", defaultValue: "3", required: true },
      ]}
      toForm={(r) => ({ name: r.name, departmentId: r.departmentId, durationYears: String(r.durationYears) })}
      onCreate={A.createCourse}
      onUpdate={A.updateCourse}
      onArchive={A.archiveCourse}
    />
  );
}

// ── Classes, divisions, teaching assignments ────────────────────
interface ClassRow { id: string; name: string; courseName: string; yearName: string; yearLevel: number; divisions: string }
interface DivisionRow { id: string; classId: string; label: string; name: string; capacity: number; enrolled: number; classTeacherId: string | null; classTeacherName: string | null; classroomId: string | null; classroomName: string | null }
interface AssignmentRow { id: string; division: string; subject: string; teacher: string }

export function ClassesManager(p: {
  classes: ClassRow[]; divisions: DivisionRow[]; assignments: AssignmentRow[];
  courses: Opt[]; years: Opt[]; classOptions: Opt[]; divisionOptions: Opt[]; subjects: Opt[]; teachers: Opt[]; classrooms: Opt[];
}) {
  const none = (o: Opt[], l: string) => [{ value: "", label: l }, ...o];
  return (
    <>
      <EntityManager<ClassRow>
        eyebrow="Academic management" title="Classes" noun="Class"
        description="A cohort of a course in an academic year. Divisions (sections) are where students enroll."
        rows={p.classes}
        searchText={(r) => `${r.name} ${r.courseName} ${r.yearName}`}
        columns={[
          { key: "name", label: "Class", render: (r) => <Link href={`/admin/academic/classes/${r.id}`}><strong>{r.name}</strong></Link> },
          { key: "course", label: "Course", hideOnMobile: true, render: (r) => r.courseName },
          { key: "year", label: "Academic year", render: (r) => r.yearName },
          { key: "lvl", label: "Level", align: "right", render: (r) => r.yearLevel },
          { key: "divs", label: "Divisions", render: (r) => r.divisions || "—" },
        ]}
        fields={[
          { name: "name", label: "Class name", required: true, placeholder: "BSc CS – Year 1" },
          { name: "courseId", label: "Course", type: "select", options: p.courses, required: true },
          { name: "academicYearId", label: "Academic year", type: "select", options: p.years, required: true },
          { name: "yearLevel", label: "Year level", type: "number", defaultValue: "1", required: true },
          { name: "firstDivision", label: "First division (optional)", placeholder: "A", hint: "Creates a division so you can enroll students right away." },
          { name: "capacity", label: "Division capacity", type: "number", defaultValue: "60" },
        ]}
        onCreate={A.createClass}
        onArchive={A.archiveClass}
      />

      <EntityManager<DivisionRow>
        title="Divisions" noun="Division"
        description="Capacity, class teacher and home classroom for each section."
        rows={p.divisions}
        searchText={(r) => `${r.label} ${r.classTeacherName ?? ""}`}
        columns={[
          { key: "label", label: "Division", render: (r) => <Link href={`/admin/academic/divisions/${r.id}`}><strong>{r.label}</strong></Link> },
          { key: "fill", label: "Enrolled", render: (r) => `${r.enrolled} / ${r.capacity}` },
          { key: "ct", label: "Class teacher", hideOnMobile: true, render: (r) => r.classTeacherName ?? "—" },
          { key: "room", label: "Classroom", hideOnMobile: true, render: (r) => r.classroomName ?? "—" },
        ]}
        fields={[
          { name: "classId", label: "Class", type: "select", options: p.classOptions, required: true, createOnly: true },
          { name: "name", label: "Division", required: true, createOnly: true, placeholder: "A" },
          { name: "capacity", label: "Capacity", type: "number", defaultValue: "60", required: true },
          { name: "classTeacherId", label: "Class teacher", type: "select", options: none(p.teachers, "— None —") },
          { name: "classroomId", label: "Home classroom", type: "select", options: none(p.classrooms, "— None —") },
        ]}
        toForm={(r) => ({ capacity: String(r.capacity), classTeacherId: r.classTeacherId ?? "", classroomId: r.classroomId ?? "" })}
        onCreate={A.createDivision}
        onUpdate={A.updateDivision}
        onArchive={A.archiveDivision}
      />

      <EntityManager<AssignmentRow>
        title="Teaching assignments" noun="Assignment"
        description="Which teacher teaches which subject to which division. The timetable uses these."
        rows={p.assignments}
        searchText={(r) => `${r.division} ${r.subject} ${r.teacher}`}
        columns={[
          { key: "div", label: "Division", render: (r) => r.division },
          { key: "sub", label: "Subject", render: (r) => <strong>{r.subject}</strong> },
          { key: "t", label: "Teacher", render: (r) => r.teacher },
        ]}
        fields={[
          { name: "divisionId", label: "Division", type: "select", options: p.divisionOptions, required: true },
          { name: "subjectId", label: "Subject", type: "select", options: p.subjects, required: true },
          { name: "teacherId", label: "Teacher", type: "select", options: p.teachers, required: true },
        ]}
        onCreate={A.assignTeacher}
        onArchive={A.removeTeacherAssignment}
        archiveVerb="Remove"
        emptyText="Assign a teacher to a subject for a division."
      />
    </>
  );
}

// ── Subjects ────────────────────────────────────────────────────
interface SubjectRow { id: string; code: string; name: string; departmentId: string | null; departmentName: string | null; type: "THEORY" | "PRACTICAL" | "BOTH"; credits: number; periodsPerWeek: number }

export function SubjectsManager({ rows, departments }: { rows: SubjectRow[]; departments: Opt[] }) {
  return (
    <EntityManager<SubjectRow>
      eyebrow="Academic management" title="Subjects" noun="Subject"
      description="Subject codes, weekly period allowance and department."
      rows={rows}
      searchText={(r) => `${r.code} ${r.name} ${r.departmentName ?? ""}`}
      columns={[
        { key: "code", label: "Code", render: (r) => <PillChip tone="brand">{r.code}</PillChip> },
        { key: "name", label: "Subject", render: (r) => <Link href={`/admin/academic/subjects/${r.id}`}><strong>{r.name}</strong></Link> },
        { key: "dept", label: "Department", hideOnMobile: true, render: (r) => r.departmentName ?? "—" },
        { key: "type", label: "Type", hideOnMobile: true, render: (r) => r.type.toLowerCase() },
        { key: "ppw", label: "Periods/wk", align: "right", render: (r) => r.periodsPerWeek },
        { key: "cr", label: "Credits", align: "right", hideOnMobile: true, render: (r) => r.credits },
      ]}
      fields={[
        { name: "code", label: "Code", required: true, createOnly: true },
        { name: "name", label: "Name", required: true },
        { name: "departmentId", label: "Department", type: "select", options: [{ value: "", label: "— None —" }, ...departments] },
        { name: "type", label: "Type", type: "select", defaultValue: "THEORY", options: [{ value: "THEORY", label: "Theory" }, { value: "PRACTICAL", label: "Practical" }, { value: "BOTH", label: "Theory + practical" }] },
        { name: "credits", label: "Credits", type: "number", defaultValue: "0" },
        { name: "periodsPerWeek", label: "Periods per week", type: "number", defaultValue: "4", required: true },
      ]}
      toForm={(r) => ({ name: r.name, departmentId: r.departmentId ?? "", type: r.type, credits: String(r.credits), periodsPerWeek: String(r.periodsPerWeek) })}
      onCreate={A.createSubject}
      onUpdate={A.updateSubject}
      onArchive={A.archiveSubject}
    />
  );
}

// ── Periods ─────────────────────────────────────────────────────
interface PeriodRow { id: string; name: string; sequence: number; startTime: string; endTime: string; kind: "CLASS" | "BREAK" | "LUNCH" }

export function PeriodsManager({ rows, nextSequence }: { rows: PeriodRow[]; nextSequence: number }) {
  return (
    <EntityManager<PeriodRow>
      eyebrow="Academic management" title="Periods" noun="Period"
      description="The bell schedule. Times are configurable; breaks and lunch cannot hold classes."
      rows={rows}
      searchText={(r) => r.name}
      columns={[
        { key: "seq", label: "#", render: (r) => r.sequence },
        { key: "name", label: "Name", render: (r) => <Link href={`/admin/academic/periods/${r.id}`}><strong>{r.name}</strong></Link> },
        { key: "time", label: "Time", render: (r) => `${r.startTime} – ${r.endTime}` },
        { key: "kind", label: "Type", render: (r) => <PillChip tone={r.kind === "CLASS" ? "brand" : "warn"}>{r.kind.toLowerCase()}</PillChip> },
      ]}
      fields={[
        { name: "name", label: "Name", required: true, placeholder: "Period 1" },
        { name: "sequence", label: "Order", type: "number", required: true, createOnly: true, defaultValue: String(nextSequence) },
        { name: "startTime", label: "Starts", type: "time", required: true },
        { name: "endTime", label: "Ends", type: "time", required: true },
        { name: "kind", label: "Type", type: "select", defaultValue: "CLASS", options: [{ value: "CLASS", label: "Class" }, { value: "BREAK", label: "Break" }, { value: "LUNCH", label: "Lunch" }] },
      ]}
      toForm={(r) => ({ name: r.name, startTime: r.startTime, endTime: r.endTime, kind: r.kind })}
      onCreate={A.createPeriod}
      onUpdate={A.updatePeriod}
      onArchive={A.archivePeriod}
    />
  );
}

// ── Classrooms ──────────────────────────────────────────────────
interface RoomRow { id: string; code: string; name: string; building: string | null; capacity: number; hasSmartBoard: boolean }

export function ClassroomsManager({ rows }: { rows: RoomRow[] }) {
  return (
    <EntityManager<RoomRow>
      eyebrow="Academic management" title="Classrooms" noun="Classroom"
      description="Rooms the timetable can book. Smart-board rooms can receive screen sharing."
      rows={rows}
      searchText={(r) => `${r.code} ${r.name} ${r.building ?? ""}`}
      columns={[
        { key: "code", label: "Code", render: (r) => <PillChip tone="brand">{r.code}</PillChip> },
        { key: "name", label: "Room", render: (r) => <strong>{r.name}</strong> },
        { key: "b", label: "Building", hideOnMobile: true, render: (r) => r.building ?? "—" },
        { key: "cap", label: "Capacity", align: "right", render: (r) => r.capacity },
        { key: "sb", label: "Smart board", render: (r) => (r.hasSmartBoard ? <PillChip tone="ok">yes</PillChip> : "—") },
      ]}
      fields={[
        { name: "code", label: "Code", required: true, createOnly: true },
        { name: "name", label: "Name", required: true },
        { name: "building", label: "Building" },
        { name: "capacity", label: "Capacity", type: "number", defaultValue: "60", required: true },
        { name: "hasSmartBoard", label: "Has a smart board", type: "checkbox" },
      ]}
      toForm={(r) => ({ name: r.name, building: r.building ?? "", capacity: String(r.capacity), hasSmartBoard: r.hasSmartBoard ? "true" : "" })}
      onCreate={A.createClassroom}
      onUpdate={A.updateClassroom}
      onArchive={A.archiveClassroom}
    />
  );
}

export { toDateInput };
