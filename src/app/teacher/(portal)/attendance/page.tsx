import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/guards";
import { PageHeader, PageWrap } from "@/components/dashboard/Kit";
import { EmptyState } from "@/components/ui/EmptyState";
import { AttendanceDay } from "@/features/attendance/AttendanceDay";
import { isYmd, MAX_BACKDATE_DAYS, rostersForDay, shiftYmd, teacherSlots, todayYmd } from "@/features/attendance/queries";
import { institutionTimezone } from "@/features/schedule/today";

export const metadata = { title: "Attendance · EduCore" };

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string; entry?: string }> }) {
  const s = await requirePagePermission("classroom.teach", "/teacher/login");
  const q = await searchParams;
  const today = todayYmd(await institutionTimezone(s.institutionId));
  const oldest = shiftYmd(today, -MAX_BACKDATE_DAYS);
  const date = q.date && isYmd(q.date) && q.date <= today && q.date >= oldest ? q.date : today;

  const mine = await teacherSlots(s.institutionId, s.userId, date);
  const slots = mine?.slots ?? [];
  const rosters = await rostersForDay(slots, date); // every period at once, so the period tabs switch instantly
  const first = slots.find((x) => x.entryId === q.entry)?.entryId ?? slots[0]?.entryId;
  const link = (d: string) => `/teacher/attendance?date=${d}`;

  return (
    <PageWrap>
      <PageHeader eyebrow="Teaching" title="Attendance" description={`Mark who is in class. You can update the last ${MAX_BACKDATE_DAYS} days.`} />

      <form method="get" action="/teacher/attendance" className="cd-row" aria-label="Choose a date">
        <Link className="ds-btn outline sm" href={link(shiftYmd(date, -1))} aria-disabled={date <= oldest} tabIndex={date <= oldest ? -1 : 0}>← Previous day</Link>
        <label className="cd-row" style={{ gap: 6 }}>
          <span className="cd-muted">Date</span>
          <input type="date" name="date" defaultValue={date} min={oldest} max={today} aria-label="Date" />
        </label>
        <button type="submit" className="ds-btn tonal sm">Go</button>
        <Link className="ds-btn outline sm" href={link(shiftYmd(date, 1))} aria-disabled={date >= today} tabIndex={date >= today ? -1 : 0}>Next day →</Link>
        {date !== today && <Link className="ds-btn outline sm" href="/teacher/attendance">Today</Link>}
      </form>

      {slots.length === 0 || !first ? (
        <EmptyState mood="sleepy" prop="calendar" title="No classes on this date">You have no timetabled classes on {date}. Pick another day.</EmptyState>
      ) : (
        <AttendanceDay key={date} slots={slots} rosters={rosters} date={date} initialEntry={first} />
      )}
    </PageWrap>
  );
}
