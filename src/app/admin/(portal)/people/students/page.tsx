import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { StudentsManager } from "@/features/people/clients";
import { toDateInput } from "@/lib/format";

export const metadata = { title: "Students · Campus 2035" };

export default async function Page() {
  const s = await requirePagePermission("students.manage");
  const inst = { institutionId: s.institutionId };
  const active = await prisma.academicYear.findFirst({ where: { ...inst, status: "ACTIVE" } });
  const [students, departments, courses, divisions] = await Promise.all([
    prisma.user.findMany({
      where: { ...inst, student: { isNot: null }, status: { not: "ARCHIVED" } },
      orderBy: { fullName: "asc" },
      take: 1000,
      include: {
        student: { include: { department: { select: { name: true } }, enrollments: { where: { status: "ACTIVE" }, take: 1, orderBy: { enrolledAt: "desc" }, include: { division: { include: { class: { select: { name: true } } } } } } } },
        credentials: { orderBy: { issuedAt: "desc" }, take: 1, select: { status: true } },
      },
    }),
    prisma.department.findMany({ where: { ...inst, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.course.findMany({ where: { ...inst, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.division.findMany({
      where: { ...inst, archivedAt: null, class: { archivedAt: null, ...(active ? { academicYearId: active.id } : {}) } },
      include: { class: { select: { name: true } } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  return (
    <StudentsManager
      departments={departments.map((d) => ({ value: d.id, label: d.name }))}
      courses={courses.map((c) => ({ value: c.id, label: c.name }))}
      divisions={divisions.map((d) => ({ value: d.id, label: `${d.class.name} · Div ${d.name}` }))}
      rows={students.map((u) => {
        const st = u.student!;
        const en = st.enrollments[0];
        return {
          id: u.id, name: u.fullName, studentCode: st.studentCode, admissionNumber: st.admissionNumber, email: u.email, phone: st.phone,
          guardianName: st.guardianName, guardianPhone: st.guardianPhone, guardianRelation: st.guardianRelation,
          dateOfBirth: st.dateOfBirth ? toDateInput(st.dateOfBirth) : "", departmentId: st.departmentId, courseId: st.courseId,
          department: st.department?.name ?? null, classLabel: en ? `${en.division.class.name} · ${en.division.name}` : null,
          status: u.status as "ACTIVE" | "INACTIVE" | "ARCHIVED", cardStatus: u.credentials[0]?.status ?? null,
        };
      })}
    />
  );
}
