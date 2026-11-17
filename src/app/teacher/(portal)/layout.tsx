import { Portal } from "@/components/layout/Portal";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <Portal roles={["TEACHER"]} loginPath="/teacher/login" homeHref="/teacher">
      {children}
    </Portal>
  );
}
