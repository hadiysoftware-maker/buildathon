"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { action, UserError } from "../shared";
import { teacherOf } from "../assignments/context";

const PATHS = ["/teacher/lessons", "/teacher", "/student"];

const Save = z.object({
  divisionId: z.string().min(1).max(30),
  subjectId: z.string().min(1).max(30),
  topic: z.string().trim().min(2, "Say what was taught").max(200),
  summary: z.string().trim().max(1000).optional(),
  homework: z.string().trim().max(500).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type SaveLessonInput = z.input<typeof Save>;

const dayOf = (d?: string) => new Date((d ?? new Date().toISOString().slice(0, 10)) + "T00:00:00.000Z");

/** Records what the teacher taught a class today (or on a given day). Only for classes and subjects they teach. */
export async function saveLesson(input: SaveLessonInput) {
  return action("classroom.teach", async (s) => {
    const d = Save.parse(input);
    const teacherId = await teacherOf(s);
    const teaches = await prisma.teacherAssignment.count({ where: { teacherId, divisionId: d.divisionId, subjectId: d.subjectId } });
    if (!teaches) throw new UserError("You can only log lessons for classes and subjects you teach.");
    const date = dayOf(d.date);
    if (date.getTime() > Date.now() + 86400000) throw new UserError("You cannot log a lesson in the future.");
    const row = await prisma.lessonLog.create({ data: { institutionId: s.institutionId, divisionId: d.divisionId, subjectId: d.subjectId, teacherId, date, topic: d.topic, summary: d.summary || null, homework: d.homework || null } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "lesson.log", entityType: "LessonLog", entityId: row.id });
    return { id: row.id };
  }, PATHS);
}

export async function deleteLesson(id: string) {
  return action("classroom.teach", async (s) => {
    const teacherId = await teacherOf(s);
    const r = await prisma.lessonLog.deleteMany({ where: { id: z.string().max(30).parse(id), teacherId, institutionId: s.institutionId } });
    if (!r.count) throw new UserError("Lesson not found.");
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "lesson.delete", entityType: "LessonLog", entityId: id });
  }, PATHS);
}
