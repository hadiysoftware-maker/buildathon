import { requireRolePage } from "@/lib/auth/guards";
import { WeekPage } from "@/features/schedule/week";

export const metadata = { title: "My timetable · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  return <WeekPage institutionId={s.institutionId} userId={s.userId} who="student" />;
}
