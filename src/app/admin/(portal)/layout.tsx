import { Portal } from "@/components/layout/Portal";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Portal roles={["SUPER_ADMIN", "ADMIN"]} loginPath="/admin/login" homeHref="/admin">
      {children}
    </Portal>
  );
}
