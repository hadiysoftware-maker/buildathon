"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

const FIELD = { flex: 1, border: 0, outline: 0, background: "transparent", font: "inherit", height: "100%" } as const;

/** Secondary sign-in: username and password. */
export function UserPasswordForm({ portal }: { portal: "kiosk" | "teacher" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password, portal }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) { router.replace(data.redirect); return; }
      setError(data.error ?? "Sign in failed.");
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      <label className="lg-field">
        <span>Username</span>
        <div className="lg-input"><Icon name="user" size={18} />
          <input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={(e) => setUsername(e.target.value)} style={FIELD} />
        </div>
      </label>
      <label className="lg-field">
        <span>Password</span>
        <div className="lg-input"><Icon name="lock" size={18} />
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={FIELD} />
        </div>
      </label>
      {error && <p className="lg-error" role="alert">{error}</p>}
      <button type="submit" className="lg-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
