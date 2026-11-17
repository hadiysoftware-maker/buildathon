import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { AdminLoginForm } from "@/components/smart-id/AdminLoginForm";
import { getSession } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/permissions";

export const metadata = { title: "Administrator · Campus 2035" };
export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  const s = await getSession().catch(() => null);
  if (s && isAdminRole(s.role)) redirect("/admin");
  return (
    <AuthShell title="Administrator sign in" subtitle="Use your administrator email or username and password." bubble="Let's get campus running.">
      <AdminLoginForm />
    </AuthShell>
  );
}
