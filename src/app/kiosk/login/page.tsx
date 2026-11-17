import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { SmartIdLogin } from "@/components/smart-id/SmartIdLogin";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Student kiosk · Campus 2035" };
export const dynamic = "force-dynamic";

export default async function KioskLogin() {
  const s = await getSession().catch(() => null);
  if (s?.role === "STUDENT") redirect("/student");
  return (
    <AuthShell title="Student sign in" subtitle="Hold your Smart ID card up to the camera." bubble="Show me your card!">
      <SmartIdLogin portal="kiosk" />
    </AuthShell>
  );
}
