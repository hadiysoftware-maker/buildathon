export interface SlotEntry {
  id?: string;
  divisionId: string;
  dayOfWeek: number;
  periodId: string;
  subjectId: string;
  teacherId: string;
  classroomId?: string | null;
}

export type ConflictKind = "TEACHER_DOUBLE_BOOKED" | "CLASSROOM_DOUBLE_BOOKED" | "DIVISION_SLOT_TAKEN" | "SUBJECT_WORKLOAD";

export interface Conflict {
  kind: ConflictKind;
  message: string;
  withEntryId?: string;
}

/**
 * Validates a candidate timetable entry against existing active entries.
 * `existing` must exclude the candidate itself when editing (pass `candidate.id` to skip it).
 * `periodsPerWeek` (optional) is the subject's weekly allowance for the division.
 */
export function detectConflicts(
  candidate: SlotEntry,
  existing: SlotEntry[],
  opts: { periodsPerWeek?: number } = {},
): Conflict[] {
  const out: Conflict[] = [];
  const others = existing.filter((e) => !(candidate.id && e.id === candidate.id));
  const sameSlot = others.filter((e) => e.dayOfWeek === candidate.dayOfWeek && e.periodId === candidate.periodId);

  const div = sameSlot.find((e) => e.divisionId === candidate.divisionId);
  if (div) out.push({ kind: "DIVISION_SLOT_TAKEN", message: "This class already has a subject in that period.", withEntryId: div.id });

  const teacher = sameSlot.find((e) => e.teacherId === candidate.teacherId);
  if (teacher) out.push({ kind: "TEACHER_DOUBLE_BOOKED", message: "The teacher is already teaching another class in that period.", withEntryId: teacher.id });

  if (candidate.classroomId) {
    const room = sameSlot.find((e) => e.classroomId === candidate.classroomId);
    if (room) out.push({ kind: "CLASSROOM_DOUBLE_BOOKED", message: "The classroom is already in use in that period.", withEntryId: room.id });
  }

  if (opts.periodsPerWeek != null) {
    const used = others.filter((e) => e.divisionId === candidate.divisionId && e.subjectId === candidate.subjectId).length;
    if (used + 1 > opts.periodsPerWeek) {
      out.push({ kind: "SUBJECT_WORKLOAD", message: `This subject is limited to ${opts.periodsPerWeek} periods per week for the class.` });
    }
  }
  return out;
}
