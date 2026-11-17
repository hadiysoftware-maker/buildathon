"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { action, UserError } from "../shared";
import { notify } from "../notify";
import { addPortfolio } from "../portfolio/record";
import { studentOf, teacherOf } from "./context";

const PATHS = ["/teacher/assignments", "/student/assignments", "/teacher", "/student"];
const TYPES = ["WRITTEN", "PDF", "DOCUMENT", "IMAGE", "VIDEO", "SHORT_ANSWER", "PRACTICAL"] as const;

const Save = z.object({
  id: z.string().max(30).optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  instructions: z.string().trim().min(1, "Add instructions").max(8000),
  subjectId: z.string().min(1, "Choose a subject").max(30),
  divisionId: z.string().min(1, "Choose a class").max(30),
  submissionType: z.enum(TYPES),
  maxMarks: z.coerce.number().min(1, "Marks must be at least 1").max(1000),
  dueAt: z.string().min(1, "Choose a due date"),
  allowLate: z.boolean(),
  allowResubmission: z.boolean(),
  fileIds: z.array(z.string().max(30)).max(5).default([]),
  publish: z.boolean().default(false),
});
export type SaveAssignmentInput = z.input<typeof Save>;

async function ownAssignment(id: string, institutionId: string, teacherId: string) {
  const a = await prisma.assignment.findFirst({ where: { id, institutionId, teacherId } });
  if (!a) throw new UserError("Assignment not found.");
  return a;
}

async function studentUserIds(divisionId: string) {
  const rows = await prisma.enrollment.findMany({ where: { divisionId, status: "ACTIVE" }, select: { student: { select: { userId: true } } } });
  return rows.map((r) => r.student.userId);
}

async function publish(institutionId: string, id: string, title: string, divisionId: string, due: Date) {
  await prisma.assignment.update({ where: { id }, data: { status: "PUBLISHED", publishAt: new Date() } });
  await notify(institutionId, await studentUserIds(divisionId), {
    type: "assignment.new",
    title: `New assignment: ${title}`,
    body: `Due ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
    link: `/student/assignments/${id}`,
  });
}

export async function saveAssignment(input: SaveAssignmentInput) {
  return action("assignments.manage", async (s) => {
    const d = Save.parse(input);
    const teacherId = await teacherOf(s);
    const teaches = await prisma.teacherAssignment.count({ where: { teacherId, subjectId: d.subjectId, divisionId: d.divisionId } });
    if (!teaches) throw new UserError("You can only set work for a subject and class you teach.");
    const due = new Date(d.dueAt);
    if (Number.isNaN(due.getTime())) throw new UserError("Choose a valid due date.");
    const files = d.fileIds.length
      ? await prisma.fileObject.findMany({ where: { id: { in: d.fileIds }, institutionId: s.institutionId, uploadedById: s.userId, deletedAt: null }, select: { id: true } })
      : [];
    const data = {
      title: d.title, instructions: d.instructions, subjectId: d.subjectId, divisionId: d.divisionId, submissionType: d.submissionType,
      maxMarks: d.maxMarks, dueAt: due, allowLate: d.allowLate, allowResubmission: d.allowResubmission,
    };
    let id = d.id;
    let wasPublished = false;
    if (id) {
      const prev = await ownAssignment(id, s.institutionId, teacherId);
      wasPublished = prev.status === "PUBLISHED";
      const graded = await prisma.grade.count({ where: { submission: { assignmentId: id } } });
      if (graded && Number(prev.maxMarks) !== d.maxMarks) throw new UserError("Marks cannot change after grading has started.");
      await prisma.assignment.update({ where: { id }, data });
      if (files.length) await prisma.assignmentAttachment.createMany({ data: files.map((f) => ({ assignmentId: id!, fileId: f.id })), skipDuplicates: true });
    } else {
      const a = await prisma.assignment.create({
        data: { ...data, institutionId: s.institutionId, teacherId, createdById: s.userId, status: "DRAFT", attachments: { create: files.map((f) => ({ fileId: f.id })) } },
      });
      id = a.id;
    }
    if (d.publish && !wasPublished) await publish(s.institutionId, id, d.title, d.divisionId, due);
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: d.id ? "assignment.update" : "assignment.create", entityType: "Assignment", entityId: id });
    return { id };
  }, PATHS);
}

export async function setAssignmentStatus(id: string, status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED") {
  return action("assignments.manage", async (s) => {
    const a = await ownAssignment(id, s.institutionId, await teacherOf(s));
    if (status === "PUBLISHED" && a.status !== "PUBLISHED") {
      await publish(s.institutionId, id, a.title, a.divisionId, a.dueAt);
    } else if (status === "DRAFT") {
      if (await prisma.submission.count({ where: { assignmentId: id } })) throw new UserError("This assignment already has submissions. Close it instead.");
      await prisma.assignment.update({ where: { id }, data: { status } });
    } else {
      await prisma.assignment.update({ where: { id }, data: { status } });
    }
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: `assignment.${status.toLowerCase()}`, entityType: "Assignment", entityId: id });
  }, PATHS);
}

export async function deleteAssignment(id: string) {
  return action("assignments.manage", async (s) => {
    await ownAssignment(id, s.institutionId, await teacherOf(s));
    if (await prisma.submission.count({ where: { assignmentId: id } })) {
      await prisma.assignment.update({ where: { id }, data: { status: "ARCHIVED" } });
    } else {
      await prisma.assignment.delete({ where: { id } });
    }
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "assignment.delete", entityType: "Assignment", entityId: id });
  }, PATHS);
}

export async function removeAttachment(assignmentId: string, fileId: string) {
  return action("assignments.manage", async (s) => {
    await ownAssignment(assignmentId, s.institutionId, await teacherOf(s));
    await prisma.assignmentAttachment.deleteMany({ where: { assignmentId, fileId } });
  }, PATHS);
}

const GradeIn = z.object({
  submissionId: z.string().min(1).max(30),
  marks: z.coerce.number().min(0, "Marks cannot be negative"),
  feedback: z.string().trim().max(4000).optional().transform((v) => v || undefined),
  release: z.boolean(),
});

export async function gradeSubmission(input: z.input<typeof GradeIn>) {
  return action("assignments.manage", async (s) => {
    const d = GradeIn.parse(input);
    const teacherId = await teacherOf(s);
    const sub = await prisma.submission.findFirst({
      where: { id: d.submissionId, assignment: { institutionId: s.institutionId, teacherId } },
      include: { assignment: true, student: { select: { userId: true } } },
    });
    if (!sub) throw new UserError("Submission not found.");
    const max = Number(sub.assignment.maxMarks);
    if (d.marks > max) throw new UserError(`Marks cannot be more than ${max}.`);
    const now = new Date();
    await prisma.grade.upsert({
      where: { submissionId: sub.id },
      create: { submissionId: sub.id, marks: d.marks, status: d.release ? "RELEASED" : "DRAFT", gradedById: s.userId, releasedAt: d.release ? now : null },
      update: { marks: d.marks, status: d.release ? "RELEASED" : "DRAFT", gradedById: s.userId, gradedAt: now, releasedAt: d.release ? now : null },
    });
    await prisma.submission.update({ where: { id: sub.id }, data: { status: d.release ? "RETURNED" : "GRADED" } });
    if (d.feedback) await prisma.feedback.create({ data: { submissionId: sub.id, authorId: s.userId, body: d.feedback } });
    if (d.release) {
      await notify(s.institutionId, [sub.student.userId], { type: "assignment.graded", title: `Graded: ${sub.assignment.title}`, body: `You scored ${d.marks} / ${max}`, link: `/student/assignments/${sub.assignmentId}` });
      await addPortfolio(sub.studentId, { type: "ASSIGNMENT", title: sub.assignment.title, summary: `Scored ${d.marks} / ${max}`, sourceType: "Submission", sourceId: sub.id });
    }
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: d.release ? "grade.release" : "grade.save", entityType: "Submission", entityId: sub.id });
  }, PATHS);
}

export async function releaseAllGrades(assignmentId: string) {
  return action("assignments.manage", async (s) => {
    const a = await ownAssignment(assignmentId, s.institutionId, await teacherOf(s));
    const drafts = await prisma.grade.findMany({
      where: { status: "DRAFT", submission: { assignmentId } },
      include: { submission: { select: { id: true, studentId: true, student: { select: { userId: true } } } } },
    });
    const now = new Date();
    for (const g of drafts) {
      await prisma.grade.update({ where: { id: g.id }, data: { status: "RELEASED", releasedAt: now } });
      await prisma.submission.update({ where: { id: g.submissionId }, data: { status: "RETURNED" } });
      await addPortfolio(g.submission.studentId, { type: "ASSIGNMENT", title: a.title, summary: `Scored ${Number(g.marks)} / ${Number(a.maxMarks)}`, sourceType: "Submission", sourceId: g.submissionId });
    }
    await notify(s.institutionId, drafts.map((g) => g.submission.student.userId), { type: "assignment.graded", title: `Graded: ${a.title}`, body: "Your grade is ready.", link: `/student/assignments/${a.id}` });
    return { released: drafts.length };
  }, PATHS);
}

export async function requestResubmission(submissionId: string, note: string) {
  return action("assignments.manage", async (s) => {
    const teacherId = await teacherOf(s);
    const sub = await prisma.submission.findFirst({
      where: { id: submissionId, assignment: { institutionId: s.institutionId, teacherId } },
      include: { assignment: { select: { title: true } }, student: { select: { userId: true } } },
    });
    if (!sub) throw new UserError("Submission not found.");
    await prisma.submission.update({ where: { id: sub.id }, data: { status: "RESUBMIT_REQUESTED" } });
    if (note.trim()) await prisma.feedback.create({ data: { submissionId: sub.id, authorId: s.userId, body: note.trim().slice(0, 4000) } });
    await notify(s.institutionId, [sub.student.userId], { type: "assignment.resubmit", title: `Please resubmit: ${sub.assignment.title}`, body: note.trim().slice(0, 200) || undefined, link: `/student/assignments/${sub.assignmentId}` });
  }, PATHS);
}

const SubmitIn = z.object({
  assignmentId: z.string().min(1).max(30),
  text: z.string().trim().max(20000).optional().transform((v) => v || undefined),
  fileIds: z.array(z.string().max(30)).max(5).default([]),
});

export async function submitAssignment(input: z.input<typeof SubmitIn>) {
  return action("assignments.submit", async (s) => {
    const d = SubmitIn.parse(input);
    const { studentId, divisionId } = await studentOf(s);
    if (!divisionId) throw new UserError("You are not enrolled in a class yet.");
    const a = await prisma.assignment.findFirst({
      where: { id: d.assignmentId, institutionId: s.institutionId, divisionId, status: "PUBLISHED" },
      include: { teacher: { select: { userId: true } } },
    });
    if (!a) throw new UserError("This assignment is not open for submissions.");
    if (!d.text && d.fileIds.length === 0) throw new UserError("Add an answer or attach a file.");
    const late = new Date() > a.dueAt;
    if (late && !a.allowLate) throw new UserError("The deadline has passed and late work is not accepted.");
    const last = await prisma.submission.findFirst({ where: { assignmentId: a.id, studentId }, orderBy: { attempt: "desc" } });
    if (last && !a.allowResubmission && last.status !== "RESUBMIT_REQUESTED") throw new UserError("You have already submitted this assignment.");
    const files = d.fileIds.length
      ? await prisma.fileObject.findMany({ where: { id: { in: d.fileIds }, institutionId: s.institutionId, uploadedById: s.userId, deletedAt: null }, select: { id: true } })
      : [];
    const sub = await prisma.submission.create({
      data: { assignmentId: a.id, studentId, attempt: (last?.attempt ?? 0) + 1, status: late ? "LATE" : "SUBMITTED", textAnswer: d.text, isLate: late, files: { create: files.map((f) => ({ fileId: f.id })) } },
    });
    await notify(s.institutionId, [a.teacher.userId], { type: "assignment.submitted", title: `New submission: ${a.title}`, link: `/teacher/assignments/${a.id}` });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "submission.create", entityType: "Submission", entityId: sub.id });
    return { late };
  }, PATHS);
}
