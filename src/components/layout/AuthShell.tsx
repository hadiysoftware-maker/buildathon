import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Mascot } from "@/components/ui/Mascot";

/** Split login layout (`.lg-*`): mascot panel on the left, task on the right. */
export function AuthShell({
  title,
  subtitle,
  bubble,
  children,
  back = true,
}: {
  title: string;
  subtitle: string;
  bubble: string;
  children: React.ReactNode;
  back?: boolean;
}) {
  return (
    <div className="lg-page ds-theme">
      <div className="lg-shell">
        <aside className="lg-side">
          <Logo size={32} />
          <div className="lg-stage">
            <p className="lg-bubble">{bubble}</p>
            <Mascot mood="happy" pose="wave" prop="book" size={190} />
          </div>
          <div className="lg-side-foot">
            <b>Campus 2035</b>
            <span>Tap your Smart ID card. No passwords for students and teachers.</span>
          </div>
        </aside>
        <main className="lg-main">
          {back && (
            <Link href="/login" className="lg-back">
              ← All sign-in options
            </Link>
          )}
          <div className="lg-form" style={{ width: "min(460px, 100%)" }}>
            <h1>{title}</h1>
            <p style={{ margin: 0, color: "var(--md-on-surface-variant)" }}>{subtitle}</p>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
