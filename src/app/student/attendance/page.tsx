import { requireRolePage } from "@/lib/auth/guards";
import { PageHeader, PageWrap } from "@/components/dashboard/Kit";
import { EmptyState } from "@/components/ui/EmptyState";
import { studentAttendance, todayYmd } from "@/features/attendance/queries";
import { StudentAttendanceView } from "@/features/attendance/StudentAttendanceView";
import { institutionTimezone } from "@/features/schedule/today";

export const metadata = { title: "My attendance · EduCore" };

export default async function Page() {
  const s = await requireRolePage(["STUDENT"], "/kiosk/login");
  const [a, tz] = await Promise.all([studentAttendance(s.userId), institutionTimezone(s.institutionId)]);

  return (
    <PageWrap>
      <PageHeader eyebrow="Learning" title="My attendance" description="Switch between the last 7, 30 and 90 days. Excused days are not counted against you." />
      {a.total === 0 ? (
        <EmptyState mood="sleepy" prop="calendar" title="No attendance recorded yet">Your teachers mark attendance in class. It will show up here.</EmptyState>
      ) : (
        <StudentAttendanceView rows={a.rows} today={todayYmd(tz)} />
      )}
    </PageWrap>
  );
}
