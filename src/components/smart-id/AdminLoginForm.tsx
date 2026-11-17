"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        router.replace(data.redirect);
        return;
      }
      setError(data.error ?? "Sign in failed.");
    } catch {
      setError("Network error. Please try again.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      <label className="lg-field">
        <span>Email or username</span>
        <div className="lg-input">
          <Icon name="mail" size={18} />
          <input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, border: 0, outline: 0, background: "transparent", font: "inherit", height: "100%" }} />
        </div>
      </label>
      <label className="lg-field">
        <span>Password</span>
        <div className="lg-input">
          <Icon name="lock" size={18} />
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1, border: 0, outline: 0, background: "transparent", font: "inherit", height: "100%" }} />
        </div>
      </label>
      {error && <p className="lg-error" role="alert">{error}</p>}
      <button type="submit" className="lg-btn" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
