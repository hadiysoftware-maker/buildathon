"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth/log";
import { isAdminRole } from "@/lib/permissions";
import { action, UserError } from "../shared";

const Create = z.object({
  subjectId: z.string().min(1).max(30),
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().trim().max(2000).optional().transform((v) => v || undefined),
  fileId: z.string().min(1, "Upload a file first").max(30),
  publish: z.string().optional().transform((v) => v === "true"),
});

function typeOf(mime: string) {
  if (mime === "application/pdf") return "PDF" as const;
  if (mime.startsWith("video/")) return "VIDEO" as const;
  return "DOCUMENT" as const;
}

export async function createMaterial(v: Record<string, string>) {
  return action("library.manage", async (s) => {
    const d = Create.parse(v);
    const subject = await prisma.subject.findFirst({ where: { id: d.subjectId, institutionId: s.institutionId, archivedAt: null } });
    if (!subject) throw new UserError("Subject not found.");
    if (s.role === "TEACHER") {
      const t = await prisma.teacherProfile.findUnique({ where: { userId: s.userId }, select: { id: true } });
      const teaches = t ? await prisma.teacherAssignment.count({ where: { teacherId: t.id, subjectId: d.subjectId } }) : 0;
      if (!teaches) throw new UserError("You can only add material for subjects you teach.");
    }
    const file = await prisma.fileObject.findFirst({ where: { id: d.fileId, institutionId: s.institutionId, uploadedById: s.userId, deletedAt: null } });
    if (!file) throw new UserError("Uploaded file not found. Please upload it again.");
    const m = await prisma.learningMaterial.create({
      data: {
        institutionId: s.institutionId, subjectId: d.subjectId, title: d.title, description: d.description, type: typeOf(file.mimeType),
        fileId: file.id, status: d.publish ? "PUBLISHED" : "DRAFT", createdById: s.userId,
      },
    });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: "material.create", entityType: "LearningMaterial", entityId: m.id });
  }, ["/teacher/library", "/student/library"]);
}

export async function setMaterialStatus(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  return action("library.manage", async (s) => {
    const m = await prisma.learningMaterial.findFirst({ where: { id, institutionId: s.institutionId } });
    if (!m) throw new UserError("Material not found.");
    if (!isAdminRole(s.role) && m.createdById !== s.userId) throw new UserError("Only the author can change this material.");
    await prisma.learningMaterial.update({ where: { id }, data: { status } });
    await audit({ institutionId: s.institutionId, actorId: s.userId, action: `material.${status.toLowerCase()}`, entityType: "LearningMaterial", entityId: id });
  }, ["/teacher/library", "/student/library"]);
}
