"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { QrScanner, type ScanOutcome } from "./QrScanner";
import { enrollThisDevice, hasEnrolledDevice, proveDevice } from "@/lib/device-client";
import { Field } from "@/components/dashboard/Kit";
import { Icon } from "@/components/ui/Icon";

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIAL: "This ID card is not recognized.",
  REVOKED: "This ID card has been revoked.",
  SUSPENDED: "This ID card is suspended. Please contact the office.",
  REPLACED: "This ID card was replaced. Use your new card.",
  ACCOUNT_INACTIVE: "This account is not active.",
  DEVICE_UNAUTHORIZED: "This device is not authorized.",
  WRONG_PORTAL: "This card cannot be used here.",
  RATE_LIMITED: "Too many attempts. Please wait a minute and try again.",
};

export function SmartIdLogin({ portal }: { portal: "kiosk" | "teacher" }) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [enrollMsg, setEnrollMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onScan = useCallback(
    async (payload: string): Promise<ScanOutcome> => {
      const device = portal === "kiosk" ? await proveDevice() : undefined;
      const res = await fetch("/api/auth/smart-id", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload, portal, device }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setTimeout(() => router.replace(data.redirect), 600);
        return { ok: true };
      }
      return { ok: false, message: MESSAGES[data.code as string] ?? "Something went wrong. Please try again." };
    },
    [portal, router],
  );

  const enroll = async () => {
    setEnrollMsg(null);
    const r = await enrollThisDevice(code);
    setEnrollMsg(r.ok ? { ok: true, text: "This device is enrolled." } : { ok: false, text: r.error });
    if (r.ok) setCode("");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <QrScanner onScan={onScan} />
      {portal === "kiosk" && (
        <div>
          <button type="button" className="ds-btn text sm" onClick={async () => { setEnrolling((v) => !v); if (!enrolling && (await hasEnrolledDevice())) setEnrollMsg({ ok: true, text: "This device is already enrolled." }); }}>
            <Icon name="monitor" size={16} /> Enroll this laptop
          </button>
          {enrolling && (
            <div className="cd-card" style={{ marginTop: 8 }}>
              <div className="cd-card-body" style={{ display: "grid", gap: 10 }}>
                <Field label="Enrollment code" hint="Given by your administrator. Valid for 30 minutes, single use.">
                  <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} />
                </Field>
                <button type="button" className="ds-btn sm" disabled={code.trim().length < 8} onClick={enroll}>Enroll</button>
                {enrollMsg && <p className="cd-banner" data-tone={enrollMsg.ok ? "ok" : "bad"} role="status">{enrollMsg.text}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
