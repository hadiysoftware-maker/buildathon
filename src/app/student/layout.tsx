import { Portal } from "@/components/layout/Portal";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <Portal roles={["STUDENT"]} loginPath="/kiosk/login" homeHref="/student">
      {children}
    </Portal>
  );
}
