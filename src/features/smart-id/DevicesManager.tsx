"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EntityManager } from "@/components/dashboard/EntityManager";
import { PillChip, SectionCard, Sheet } from "@/components/dashboard/Kit";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import * as S from "./actions";

export interface DeviceRow {
  id: string;
  assetTag: string;
  label: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "RETIRED";
  assignedTo: string | null;
  enrolledAt: string | null;
  lastSeenAt: string | null;
}

const tone = (s: DeviceRow["status"]) => (s === "ACTIVE" ? "ok" : s === "PENDING" ? "warn" : s === "SUSPENDED" ? "bad" : "neutral");

export function DevicesManager({ rows, students, requireEnrolled, canPolicy }: { rows: DeviceRow[]; students: { value: string; label: string }[]; requireEnrolled: boolean; canPolicy: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [code, setCode] = useState<{ code: string; expiresAt: string; label: string } | null>(null);

  const enroll = (row: DeviceRow) =>
    start(async () => {
      const r = await S.issueEnrollmentCode(row.id);
      if (r.ok) { setCode({ ...r.data, label: row.label }); router.refresh(); } else toast.error(r.error);
    });
  const setStatus = (row: DeviceRow, status: "ACTIVE" | "SUSPENDED" | "RETIRED") =>
    start(async () => {
      const r = await S.setDeviceStatus(row.id, status);
      if (r.ok) { toast.success(`Device ${status.toLowerCase()}`); router.refresh(); } else toast.error(r.error);
    });
  const togglePolicy = () =>
    start(async () => {
      const r = await S.setRequireEnrolledDevice(!requireEnrolled);
      if (r.ok) { toast.success(!requireEnrolled ? "Enrolled device now required for kiosk sign-in" : "Enrolled device no longer required"); router.refresh(); } else toast.error(r.error);
    });

  return (
    <>
      <EntityManager<DeviceRow>
        eyebrow="Security" title="Devices" noun="Device"
        description="Register kiosks and student devices. A device proves itself with a private key it generates and never exports, not by browser fingerprint."
        rows={rows}
        searchText={(r) => `${r.assetTag} ${r.label} ${r.assignedTo ?? ""}`}
        columns={[
          { key: "tag", label: "Device", render: (r) => <span><strong>{r.label}</strong><br /><small className="cd-muted">{r.assetTag}</small></span> },
          { key: "who", label: "Assigned to", render: (r) => r.assignedTo ?? "Shared kiosk" },
          { key: "status", label: "Status", render: (r) => <PillChip tone={tone(r.status)}>{r.status.toLowerCase()}</PillChip> },
          { key: "seen", label: "Enrolled / last seen", render: (r) => (r.lastSeenAt ? fmtDateTime(r.lastSeenAt) : r.enrolledAt ? fmtDateTime(r.enrolledAt) : <span className="cd-muted">Not enrolled</span>) },
        ]}
        fields={[
          { name: "assetTag", label: "Asset tag", required: true, placeholder: "KIOSK-01" },
          { name: "label", label: "Label", required: true, placeholder: "Room 101 kiosk" },
          { name: "assignedStudentId", label: "Assigned student", type: "select", options: [{ value: "", label: "— Shared kiosk —" }, ...students], hint: "Optional" },
        ]}
        onCreate={S.createDevice}
        renderRowActions={(r) => (
          <>
            {r.status !== "RETIRED" && <button type="button" className="ds-btn tonal sm" disabled={busy} onClick={() => enroll(r)}><Icon name="key" size={14} /> {r.status === "PENDING" ? "Enrollment code" : "Re-enroll"}</button>}
            {r.status === "ACTIVE" && <button type="button" className="dk-icon-btn" title="Suspend" aria-label="Suspend device" disabled={busy} onClick={() => setStatus(r, "SUSPENDED")}><Icon name="lock" size={16} /></button>}
            {r.status === "SUSPENDED" && <button type="button" className="dk-icon-btn" title="Reactivate" aria-label="Reactivate device" disabled={busy} onClick={() => setStatus(r, "ACTIVE")}><Icon name="check" size={16} /></button>}
            {r.status !== "RETIRED" && <button type="button" className="dk-icon-btn" title="Retire" aria-label="Retire device" disabled={busy} onClick={() => setStatus(r, "RETIRED")}><Icon name="archive" size={16} /></button>}
          </>
        )}
        headerActions={undefined}
      />
      <PageSection requireEnrolled={requireEnrolled} canPolicy={canPolicy} busy={busy} onToggle={togglePolicy} />
      <Sheet open={!!code} onClose={() => setCode(null)} title="One-time enrollment code" subtitle={code?.label}
        footer={<button type="button" className="ds-btn sm" onClick={() => setCode(null)}>Done</button>}>
        {code && (
          <div style={{ display: "grid", gap: 12 }}>
            <p className="cd-muted">Open <strong>/kiosk/login</strong> on the device and enter this code when asked to enroll. It works once and expires at {fmtDateTime(code.expiresAt)}. It cannot be shown again.</p>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, textAlign: "center", padding: 16, border: "1px dashed var(--md-outline-variant)", borderRadius: 12, fontFamily: "monospace" }}>{code.code}</div>
          </div>
        )}
      </Sheet>
    </>
  );
}

function PageSection({ requireEnrolled, canPolicy, busy, onToggle }: { requireEnrolled: boolean; canPolicy: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <SectionCard title="Sign-in policy" icon="shield" subtitle="Controls whether kiosk and student sign-in also requires a registered, enrolled device.">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span>Require an enrolled device for kiosk sign-in: <PillChip tone={requireEnrolled ? "ok" : "warn"}>{requireEnrolled ? "on" : "off"}</PillChip></span>
        {canPolicy ? (
          <button type="button" className="ds-btn outline sm" disabled={busy} onClick={onToggle}>{requireEnrolled ? "Turn off" : "Turn on"}</button>
        ) : (
          <small className="cd-muted">Only an institution administrator can change this.</small>
        )}
      </div>
    </SectionCard>
  );
}
