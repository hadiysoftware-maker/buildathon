"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { action, UserError } from "../shared";
import { isYmd, MAX_BACKDATE_DAYS, rosterFor, shiftYmd, STATUSES, teacherSlots, todayYmd, ymdToDate } from "./queries";

const Body = z.object({
  entryId: z.string().min(1).max(30),
  date: z.string().refine(isYmd, "Pick a valid date."),
  marks: z.array(z.object({ studentId: z.string().min(1).max(30), status: z.enum(STATUSES) })).min(1, "Mark at least one student.").max(200),
});

/** Save one class's attendance. The teacher must run that class on that date (own entry or substitution). */
export async function saveAttendance(input: { entryId: string; date: string; marks: { studentId: string; status: (typeof STATUSES)[number] }[] }) {
  return action("classroom.teach", async (s) => {
    const d = Body.parse(input);
    const mine = await teacherSlots(s.institutionId, s.userId, d.date);
    if (!mine) throw new UserError("Teacher profile not found.");
    const today = todayYmd(mine.timezone);
    if (d.date > today) throw new UserError("You cannot mark attendance for a future date.");
    if (d.date < shiftYmd(today, -MAX_BACKDATE_DAYS)) throw new UserError(`Attendance can be changed for the last ${MAX_BACKDATE_DAYS} days only.`);
    const slot = mine.slots.find((x) => x.entryId === d.entryId);
    if (!slot) throw new UserError("You do not teach that class on that date.");

    const entry = await prisma.timetableEntry.findUniqueOrThrow({ where: { id: d.entryId }, select: { divisionId: true, subjectId: true, periodId: true } });
    const allowed = new Set((await rosterFor(s.institutionId, entry.divisionId, d.entryId, d.date)).map((r) => r.id));
    const marks = [...new Map(d.marks.map((m) => [m.studentId, m])).values()]; // last mark per student wins
    if (marks.some((m) => !allowed.has(m.studentId))) throw new UserError("One of the students is not in this class.");

    const date = ymdToDate(d.date);
    await prisma.$transaction(
      marks.map((m) =>
        prisma.attendance.upsert({
          where: { studentId_timetableEntryId_date: { studentId: m.studentId, timetableEntryId: d.entryId, date } },
          create: { studentId: m.studentId, timetableEntryId: d.entryId, date, divisionId: entry.divisionId, subjectId: entry.subjectId, periodId: entry.periodId, teacherId: mine.teacherId, status: m.status, source: "TEACHER_MANUAL" },
          update: { status: m.status, teacherId: mine.teacherId, source: "TEACHER_MANUAL" },
        }),
      ),
    );
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "attendance.mark", entityType: "TimetableEntry", entityId: d.entryId, metadata: { date: d.date, students: marks.length } });
    return { saved: marks.length };
  }, ["/teacher/attendance", "/student/attendance"]);
}
