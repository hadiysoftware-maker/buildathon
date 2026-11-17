import "server-only";
import { prisma } from "@/lib/db";

/** Everything printed on a card except the QR secret (which is only known at issue time). */
export interface CardView {
  credentialId: string;
  userId: string;
  fullName: string;
  institutionName: string;
  institutionalId: string;
  role: "Student" | "Teacher";
  department: string;
  detail: string; // class for students, designation for teachers
  /** QR payload. Present only immediately after issuing; the secret is not recoverable later. */
  payload: string;
}

export async function buildCardView(userId: string, credentialId: string, payload: string): Promise<CardView> {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      institution: { select: { name: true } },
      student: {
        include: {
          department: { select: { name: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            orderBy: { enrolledAt: "desc" },
            include: { division: { include: { class: { select: { name: true } } } } },
          },
        },
      },
      teacher: { include: { department: { select: { name: true } } } },
    },
  });
  if (u.student) {
    const e = u.student.enrollments[0];
    return {
      credentialId, userId, payload,
      fullName: u.fullName,
      institutionName: u.institution.name,
      institutionalId: u.student.studentCode,
      role: "Student",
      department: u.student.department?.name ?? "—",
      detail: e ? `${e.division.class.name} · Div ${e.division.name}` : "Not enrolled",
    };
  }
  return {
    credentialId, userId, payload,
    fullName: u.fullName,
    institutionName: u.institution.name,
    institutionalId: u.teacher?.teacherCode ?? "—",
    role: "Teacher",
    department: u.teacher?.department?.name ?? "—",
    detail: u.teacher?.designation ?? "Teacher",
  };
}
