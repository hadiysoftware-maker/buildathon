"use client";

import { useState } from "react";
import { Sheet } from "@/components/dashboard/Kit";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/Toast";
import { IdCard } from "./IdCard";
import { downloadBlob, exportCardsPdf } from "@/lib/card-pdf";
import type { CardView } from "@/features/smart-id/card";

function printCards() {
  document.body.classList.add("printing-active");
  const done = () => {
    document.body.classList.remove("printing-active");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/**
 * Shows freshly issued cards. The QR secret exists only in this payload — it is hashed in the
 * database and cannot be recovered — so printing/exporting must happen before closing.
 */
export function CardSheet({ cards, onClose }: { cards: CardView[]; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const open = cards.length > 0;

  const pdf = async () => {
    setBusy(true);
    try {
      downloadBlob(await exportCardsPdf(cards), cards.length === 1 ? `smart-id-${cards[0].institutionalId}.pdf` : "smart-id-cards.pdf");
    } catch {
      toast.error("Could not create the PDF.");
    }
    setBusy(false);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="xl"
      title={cards.length === 1 ? "Smart ID card ready" : `${cards.length} Smart ID cards ready`}
      subtitle="Print or save these now. For security the QR secret cannot be shown again; use Replace to issue a new card later."
      footer={
        <>
          <button type="button" className="ds-btn outline sm" onClick={onClose}>
            Done
          </button>
          <button type="button" className="ds-btn outline sm" onClick={pdf} disabled={busy}>
            <Icon name="fileExport" size={16} /> {busy ? "Preparing…" : "Download PDF"}
          </button>
          <button type="button" className="ds-btn sm" onClick={printCards}>
            <Icon name="printer" size={16} /> Print
          </button>
        </>
      }
    >
      <div className="print-target">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          {cards.map((c) => (
            <IdCard key={c.credentialId} card={c} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
