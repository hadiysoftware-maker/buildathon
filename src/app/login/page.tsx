import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { Icon } from "@/components/ui/Icon";

export const metadata = { title: "Sign in · EduCore" };

const OPTIONS = [
  { href: "/kiosk/login", icon: "graduation", title: "Student", text: "Scan your Smart ID card on your learning laptop." },
  { href: "/teacher/login", icon: "teacher", title: "Teacher", text: "Scan your Smart ID card to open your dashboard." },
  { href: "/admin/login", icon: "shield", title: "Administrator", text: "Sign in with your administrator account." },
] as const;

export default function LoginChooser() {
  return (
    <AuthShell title="Welcome to EduCore" subtitle="Choose how you sign in." bubble="Hi! Who's joining today?" back={false}>
      <div style={{ display: "grid", gap: 10 }}>
        {OPTIONS.map((o) => (
          <Link key={o.href} href={o.href} className="ds-mod-card" style={{ display: "flex", gap: 14, alignItems: "center", padding: 16 }}>
            <span className="ds-mod-ic">
              <Icon name={o.icon} size={22} />
            </span>
            <span style={{ display: "grid" }}>
              <strong>{o.title}</strong>
              <small style={{ color: "var(--md-on-surface-variant)" }}>{o.text}</small>
            </span>
          </Link>
        ))}
      </div>
    </AuthShell>
  );
}
