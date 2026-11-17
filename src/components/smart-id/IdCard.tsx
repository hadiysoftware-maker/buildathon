"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { LogoMark } from "@/components/ui/Logo";
import type { CardView } from "@/features/smart-id/card";

/** QR as a data URL. Error correction M keeps the code scannable when printed small. */
export function useQr(payload: string, width = 220): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width }).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [payload, width]);
  return url;
}

/** CR80 (85.6 × 54 mm) card face, drawn in the design-system tokens. */
export function IdCard({ card }: { card: CardView }) {
  const qr = useQr(card.payload);
  const initials = card.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div
      className="c35-card"
      style={{
        width: 342, height: 216, borderRadius: 16, overflow: "hidden", display: "grid",
        gridTemplateRows: "auto 1fr", background: "#fff", color: "#12272A", border: "1px solid #D6E5E1", fontFamily: "var(--font-poppins), system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#0F766E", color: "#fff" }}>
        <LogoMark size={22} />
        <div style={{ lineHeight: 1.1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.institutionName}</div>
          <div style={{ fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.85 }}>Smart ID · {card.role}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 86px", gap: 10, padding: 10, alignItems: "center" }}>
        <div style={{ width: 64, height: 78, borderRadius: 10, background: "#E1F4F0", color: "#0F766E", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 22 }} aria-hidden="true">
          {initials}
        </div>
        <div style={{ minWidth: 0, lineHeight: 1.3 }}>
          <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{card.fullName}</div>
          <div style={{ fontSize: 10, color: "#527170" }}>ID {card.institutionalId}</div>
          <div style={{ fontSize: 10, marginTop: 4 }}>{card.department}</div>
          <div style={{ fontSize: 10, color: "#527170" }}>{card.detail}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt={`Smart ID QR for ${card.fullName}`} width={86} height={86} /> : <div style={{ width: 86, height: 86 }} />}
      </div>
    </div>
  );
}
