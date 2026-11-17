"use client";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { CardView } from "@/features/smart-id/card";

const MM = 72 / 25.4;
const CARD_W = 85.6 * MM;
const CARD_H = 54 * MM;

/** A4 sheet, 2 × 5 CR80 cards per page, with thin cut marks (the gutter). */
export async function exportCardsPdf(cards: CardView[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W = 210 * MM;
  const PAGE_H = 297 * MM;
  const cols = 2;
  const rows = 5;
  const gx = (PAGE_W - cols * CARD_W) / (cols + 1);
  const gy = (PAGE_H - rows * CARD_H) / (rows + 1);
  const brand = rgb(0x4b / 255, 0x49 / 255, 0xac / 255);
  const ink = rgb(0x1e / 255, 0x1e / 255, 0x2f / 255);
  const muted = rgb(0x64 / 255, 0x74 / 255, 0x8b / 255);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  for (const [i, c] of cards.entries()) {
    const slot = i % (cols * rows);
    if (i > 0 && slot === 0) page = pdf.addPage([PAGE_W, PAGE_H]);
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = gx + col * (CARD_W + gx);
    const y = PAGE_H - gy - (row + 1) * CARD_H - row * gy;

    page.drawRectangle({ x, y, width: CARD_W, height: CARD_H, borderColor: rgb(0.85, 0.87, 0.93), borderWidth: 0.6, color: rgb(1, 1, 1) });
    page.drawRectangle({ x, y: y + CARD_H - 22, width: CARD_W, height: 22, color: brand });
    page.drawText(clip(c.institutionName, 38), { x: x + 8, y: y + CARD_H - 14, size: 9, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`SMART ID · ${c.role.toUpperCase()}`, { x: x + CARD_W - 92, y: y + CARD_H - 14, size: 6, font, color: rgb(1, 1, 1) });

    page.drawRectangle({ x: x + 8, y: y + 18, width: 46, height: 56, color: rgb(0.91, 0.94, 1) });
    const initials = c.fullName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
    page.drawText(initials, { x: x + 20, y: y + 40, size: 16, font: bold, color: brand });

    page.drawText(clip(c.fullName, 24), { x: x + 62, y: y + 66, size: 10, font: bold, color: ink });
    page.drawText(`ID ${c.institutionalId}`, { x: x + 62, y: y + 54, size: 7.5, font, color: muted });
    page.drawText(clip(c.department, 30), { x: x + 62, y: y + 42, size: 7.5, font, color: ink });
    page.drawText(clip(c.detail, 30), { x: x + 62, y: y + 31, size: 7.5, font, color: muted });

    const png = await QRCode.toDataURL(c.payload, { errorCorrectionLevel: "M", margin: 1, width: 320 });
    const img = await pdf.embedPng(png);
    page.drawImage(img, { x: x + CARD_W - 70, y: y + 6, width: 62, height: 62 });
  }
  return pdf.save();
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function downloadBlob(bytes: Uint8Array, name: string, mime = "application/pdf") {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
