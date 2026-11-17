import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { SmartIdLogin } from "@/components/smart-id/SmartIdLogin";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Teacher sign in · EduCore" };
export const dynamic = "force-dynamic";

export default async function TeacherLogin() {
  const s = await getSession().catch(() => null);
  if (s?.role === "TEACHER") redirect("/teacher");
  return (
    <AuthShell title="Teacher sign in" subtitle="Scan your Smart ID card to continue." bubble="Ready for class?">
      <SmartIdLogin portal="teacher" />
    </AuthShell>
  );
}
