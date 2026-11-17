import { prisma } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { Hero } from "@/components/dashboard/OverviewKit";
import { greetingNow } from "@/lib/format";
import { PageWrap } from "@/components/dashboard/Kit";
import { StatGrid } from "@/components/dashboard/StatGrid";

export const metadata = { title: "Admin overview · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["SUPER_ADMIN", "ADMIN"], "/admin/login");
  const inst = { institutionId: s.institutionId };
  const [students, teachers, classes, divisions, activeCards, noCard, devices, year] = await Promise.all([
    prisma.studentProfile.count({ where: { ...inst, user: { status: "ACTIVE" } } }),
    prisma.teacherProfile.count({ where: { ...inst, user: { status: "ACTIVE" } } }),
    prisma.class.count({ where: { ...inst, archivedAt: null } }),
    prisma.division.count({ where: { ...inst, archivedAt: null } }),
    prisma.smartIdCredential.count({ where: { ...inst, status: "ACTIVE" } }),
    prisma.user.count({ where: { ...inst, status: "ACTIVE", OR: [{ student: { isNot: null } }, { teacher: { isNot: null } }], credentials: { none: { status: { in: ["ACTIVE", "SUSPENDED"] } } } } }),
    prisma.registeredDevice.count({ where: { ...inst, status: "ACTIVE" } }),
    prisma.academicYear.findFirst({ where: { ...inst, status: "ACTIVE" }, select: { name: true } }),
  ]);
  return (
    <PageWrap>
      <Hero eyebrow={greetingNow()} title={s.user.fullName} text={year ? `Active academic year: ${year.name}.` : "No academic year is active yet. Start with Academic management → Academic years."} />
      <StatGrid
        items={[
          { icon: "students", label: "Students", value: students, href: "/admin/people/students" },
          { icon: "teacher", label: "Teachers", value: teachers, href: "/admin/people/teachers" },
          { icon: "courses", label: "Classes", value: classes, sub: `${divisions} division${divisions === 1 ? "" : "s"}`, href: "/admin/academic/classes" },
          { icon: "qr", label: "Active Smart IDs", value: activeCards, sub: noCard ? `${noCard} without a card` : "Everyone has a card", href: "/admin/smart-id" },
          { icon: "monitor", label: "Active devices", value: devices, href: "/admin/devices" },
        ]}
      />
    </PageWrap>
  );
}
