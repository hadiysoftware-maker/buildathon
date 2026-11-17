import "server-only";
import ExcelJS from "exceljs";
import { formulaOk, type WorkbookSpecT } from "./spec";

const FORMATS: Record<string, string | undefined> = { text: undefined, number: "#,##0.00", integer: "#,##0", percent: "0.0%", date: "dd-mmm-yyyy", currency: "₹#,##0.00" };
const col = (i: number) => { let n = i + 1, s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

/** Builds a workbook with live formulas. Cells that start with "=" are written as formulas ({r} becomes the row number). */
export async function buildXlsx(spec: WorkbookSpecT): Promise<{ buffer: Buffer; formulas: number }> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EduCore Copilot";
  wb.title = spec.title;
  const { primary } = spec.theme;
  let formulas = 0;

  for (const s of spec.sheets) {
    const ws = wb.addWorksheet(s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet", { views: [{ state: "frozen", ySplit: s.title ? 2 : 1, showGridLines: false }] });
    let r0 = 1;
    if (s.title) {
      ws.mergeCells(1, 1, 1, Math.max(s.columns.length, 2));
      const t = ws.getCell(1, 1);
      t.value = s.title;
      t.font = { bold: true, size: 14, color: { argb: `FF${primary}` } };
      ws.getRow(1).height = 26;
      r0 = 2;
    }
    const head = ws.getRow(r0);
    s.columns.forEach((c, i) => {
      const cell = head.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${primary}` } };
      cell.alignment = { vertical: "middle", horizontal: c.format === "text" ? "left" : "right" };
      ws.getColumn(i + 1).width = c.width ?? Math.max(12, Math.min(40, c.header.length + 4));
    });
    head.height = 22;
    if (!s.freezeHeader) ws.views = [{ state: "normal", showGridLines: false }];

    s.rows.forEach((row, ri) => {
      const rn = r0 + 1 + ri;
      s.columns.forEach((c, i) => {
        const v = row[i] ?? null;
        const cell = ws.getCell(rn, i + 1);
        if (typeof v === "string" && v.startsWith("=")) {
          const f = v.replace(/\{r\}/g, String(rn)).replace(/\{first\}/g, String(r0 + 1)).replace(/\{last\}/g, String(r0 + s.rows.length));
          if (!formulaOk(f)) throw new Error(`Row ${ri + 1}: formula not allowed: ${v.slice(0, 60)}`);
          cell.value = { formula: f.slice(1) };
          formulas++;
        } else cell.value = v;
        const nf = FORMATS[c.format];
        if (nf) cell.numFmt = nf;
        cell.border = { bottom: { style: "hair", color: { argb: "FFD9E2E0" } } };
        if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F8F7" } };
      });
    });

    const last = r0 + s.rows.length;
    if (s.totals && s.rows.length) {
      const tr = last + 1;
      const lab = ws.getCell(tr, 1);
      lab.value = s.totals.label;
      lab.font = { bold: true };
      for (const ci of s.totals.columns) {
        if (ci >= s.columns.length) continue;
        const cell = ws.getCell(tr, ci + 1);
        cell.value = { formula: `${s.totals.fn}(${col(ci)}${r0 + 1}:${col(ci)}${last})` };
        const nf = FORMATS[s.columns[ci].format];
        if (nf) cell.numFmt = nf;
        formulas++;
      }
      ws.getRow(tr).eachCell((c) => { c.font = { bold: true }; c.border = { top: { style: "thin", color: { argb: `FF${primary}` } } }; });
    }

    for (const cf of s.conditional ?? []) {
      if (cf.column >= s.columns.length || !s.rows.length) continue;
      const ref = `${col(cf.column)}${r0 + 1}:${col(cf.column)}${last}`;
      if (cf.rule === "scale") {
        ws.addConditionalFormatting({ ref, rules: [{ type: "colorScale", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], color: [{ argb: "FFFDE2E2" }, { argb: "FFC6EFD9" }] }] });
      } else {
        ws.addConditionalFormatting({ ref, rules: [{ type: "cellIs", priority: 1, operator: cf.rule === "below" ? "lessThan" : "greaterThan", formulae: [String(cf.value ?? 0)], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: cf.rule === "below" ? "FFFDE2E2" : "FFC6EFD9" } } } }] });
      }
    }
  }
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), formulas };
}
