import type { Block } from "./blocks";
/** Client-side PDF export of an assistant reply. pdf-lib is loaded on demand so it never weighs down the chat. */
const MAP: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "‑": "-", "‐": "-", "•": "-", "…": "...", "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "×": "x", "₹": "Rs ", " ": " ", "✓": "[x]", "✔": "[x]" };

/** The standard PDF fonts only cover Latin-1, so other characters are mapped or dropped. */
const clean = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/[^\x00-\xFF]/g, (c) => MAP[c] ?? "")
    .replace(/[ \t]+/g, " ");

type Item = { kind: "h" | "p" | "li"; text: string } | { kind: "table"; rows: string[][] };

function parse(md: string): Item[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: Item[] = [];
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => clean(c).trim());
  for (let i = 0; i < lines.length; ) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (isRow(l) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const rows = [cells(l)];
      i += 2;
      while (i < lines.length && isRow(lines[i])) rows.push(cells(lines[i++]));
      out.push({ kind: "table", rows });
      continue;
    }
    const h = /^#{1,4}\s+(.*)$/.exec(l);
    if (h) { out.push({ kind: "h", text: clean(h[1]) }); i++; continue; }
    const li = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(l);
    if (li) { out.push({ kind: "li", text: clean(li[1]) }); i++; continue; }
    out.push({ kind: "p", text: clean(l) });
    i++;
  }
  return out;
}

export async function exportReplyPdf(markdown: string, who: string, title = "Nova report", blocks: Block[] = []): Promise<void> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 48, CW = W - M * 2;
  const teal = rgb(0.059, 0.463, 0.431);
  const ink = rgb(0.1, 0.12, 0.12);
  let page = doc.addPage([W, H]);
  let y = H - M;

  const wrap = (text: string, f: typeof font, size: number, width: number): string[] => {
    const out: string[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const t = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) <= width) line = t;
        else { if (line) out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  };
  const ensure = (need: number) => { if (y - need < M + 20) { page = doc.addPage([W, H]); y = H - M; } };
  const text = (t: string, x: number, size: number, f = font, color = ink) => page.drawText(t, { x, y, size, font: f, color });

  // Header
  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: teal });
  text("EduCore", M, 11, bold, teal); y -= 24;
  for (const l of wrap(clean(title), bold, 18, CW)) { text(l, M, 18, bold, ink); y -= 24; }
  y += 4;
  text(`${who}  -  ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, M, 9, font, rgb(0.4, 0.45, 0.45)); y -= 26;

  // Visuals shown with the answer (charts, cards, timelines, quizzes) go into the PDF too.
  const PAL = [rgb(0.059, 0.463, 0.431), rgb(0.96, 0.72, 0.24), rgb(0.08, 0.64, 0.58), rgb(0.88, 0.48, 0.55), rgb(0.42, 0.56, 0.68), rgb(0.6, 0.66, 0.65)];
  const grey = rgb(0.4, 0.45, 0.45);
  const heading = (t: string) => { const ls = wrap(clean(t), bold, 12.5, CW); ensure(ls.length * 16 + 10); y -= 4; for (const l of ls) { text(l, M, 12.5, bold, teal); y -= 16; } };
  const line = (t: string, opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; indent?: number } = {}) => {
    const size = opts.size ?? 10;
    const ls = wrap(clean(t), opts.f ?? font, size, CW - (opts.indent ?? 0));
    ensure(ls.length * (size + 4) + 2);
    for (const l of ls) { text(l, M + (opts.indent ?? 0), size, opts.f ?? font, opts.color ?? ink); y -= size + 4; }
  };
  const drawBlock = (b: Block) => {
    if (b.type === "donut") {
      heading(b.title);
      const total = b.slices.reduce((a, s) => a + s.value, 0) || 1;
      const R = 48;
      ensure(R * 2 + 16);
      const cx = M + R, cy = y - R;
      let a0 = -Math.PI / 2;
      b.slices.forEach((sl, i) => {
        const a1 = a0 + (sl.value / total) * Math.PI * 2;
        const full = sl.value / total > 0.9999;
        const p = (a: number) => `${(R * Math.cos(a)).toFixed(2)} ${(R * Math.sin(a)).toFixed(2)}`;
        const d = full ? `M ${R} 0 A ${R} ${R} 0 1 1 ${-R} 0 A ${R} ${R} 0 1 1 ${R} 0 Z` : `M 0 0 L ${p(a0)} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
        page.drawSvgPath(d, { x: cx, y: cy, color: PAL[i % PAL.length] });
        a0 = a1;
      });
      page.drawCircle({ x: cx, y: cy, size: R * 0.58, color: rgb(1, 1, 1) });
      const tot = String(b.slices.reduce((a, s) => a + s.value, 0));
      page.drawText(tot, { x: cx - bold.widthOfTextAtSize(tot, 16) / 2, y: cy - 2, size: 16, font: bold, color: ink });
      page.drawText("total", { x: cx - font.widthOfTextAtSize("total", 7) / 2, y: cy - 12, size: 7, font, color: grey });
      b.slices.forEach((sl, i) => {
        const ly = cy + R * 0.7 - i * 16;
        page.drawRectangle({ x: M + R * 2 + 24, y: ly - 1, width: 9, height: 9, color: PAL[i % PAL.length] });
        page.drawText(`${clean(sl.label)}: ${sl.value} (${Math.round((sl.value / total) * 100)}%)`, { x: M + R * 2 + 40, y: ly, size: 10, font, color: ink });
      });
      y = cy - R - 14;
    } else if (b.type === "bar") {
      heading(b.title);
      const max = Math.max(1, ...b.rows.map((r) => r.value));
      for (const r of b.rows) {
        ensure(18);
        text(clean(r.label).slice(0, 22), M, 9.5, font, ink);
        const bw = Math.max(2, (r.value / max) * (CW - 170));
        page.drawRectangle({ x: M + 130, y: y - 2, width: bw, height: 10, color: PAL[0] });
        page.drawText(String(r.value), { x: M + 136 + bw, y, size: 9.5, font: bold, color: ink });
        y -= 16;
      }
      y -= 6;
    } else if (b.type === "stats") {
      const n = Math.min(4, b.items.length) || 1;
      const w = (CW - (n - 1) * 8) / n;
      ensure(50);
      b.items.slice(0, 4).forEach((it, i) => {
        const x = M + i * (w + 8);
        page.drawRectangle({ x, y: y - 40, width: w, height: 42, color: rgb(0.88, 0.95, 0.93) });
        page.drawText(clean(String(it.value)), { x: x + 8, y: y - 18, size: 16, font: bold, color: teal });
        page.drawText(clean(it.label).slice(0, 26), { x: x + 8, y: y - 33, size: 8.5, font, color: grey });
      });
      y -= 54;
    } else if (b.type === "timeline") {
      heading(`Timetable - ${b.date}`);
      for (const r of b.rows) {
        ensure(28);
        text(clean(r.time), M, 9.5, bold, teal);
        text(clean(r.title).slice(0, 60), M + 90, 10, r.state === "now" ? bold : font, ink);
        y -= 13;
        if (r.sub) { text(clean(r.sub).slice(0, 70), M + 90, 8.5, font, grey); y -= 11; }
        y -= 2;
      }
      y -= 4;
    } else if (b.type === "summary") {
      heading(b.title);
      b.points.forEach((p) => line(`- ${p}`, { indent: 4 }));
      if (b.next) line(`Next: ${b.next}`, { f: bold, color: teal });
      y -= 6;
    } else if (b.type === "students") {
      heading("Students");
      b.items.forEach((s) => line(`${s.name} (${s.code}) - ${s.cls} - ${s.status}`, { indent: 4 }));
      y -= 4;
    } else if (b.type === "teachers") {
      heading("Teachers");
      b.items.forEach((t) => line(`${t.name} (${t.code}) - ${t.subjects.join(", ") || "no subjects"} - ${t.classes} classes`, { indent: 4 }));
      y -= 4;
    } else if (b.type === "materials") {
      heading("Study material");
      b.items.forEach((m) => line(`${m.title} - ${m.subject} - ${m.kind} - ${m.status}`, { indent: 4 }));
      y -= 4;
    } else if (b.type === "quiz") {
      heading(b.title);
      const L = ["A", "B", "C", "D", "E"];
      b.questions.forEach((q, qi) => {
        line(`${qi + 1}. ${q.q}`, { f: bold, size: 10.5 });
        q.options.forEach((o, oi) => line(`${L[oi]}) ${o}`, { indent: 14 }));
        y -= 4;
      });
      heading("Answer key");
      b.questions.forEach((q, qi) => line(`${qi + 1}. ${L[q.answer]}${q.why ? ` - ${q.why}` : ""}`, { indent: 4, color: grey }));
      y -= 6;
    }
  };
  for (const b of blocks) drawBlock(b);

  for (const it of parse(markdown)) {
    if (it.kind === "h") {
      const ls = wrap(it.text, bold, 14, CW); ensure(ls.length * 18 + 8); y -= 6;
      for (const l of ls) { text(l, M, 14, bold, teal); y -= 18; }
    } else if (it.kind === "p" || it.kind === "li") {
      const indent = it.kind === "li" ? 14 : 0;
      const ls = wrap(it.text, font, 10.5, CW - indent);
      ensure(ls.length * 14 + 4);
      ls.forEach((l, n) => { if (it.kind === "li" && n === 0) text("-", M + 2, 10.5, bold, teal); text(l, M + indent, 10.5); y -= 14; });
      y -= 3;
    } else if (it.kind === "table") {
      const cols = Math.max(...it.rows.map((r) => r.length));
      const cw = CW / cols;
      for (const [ri, row] of it.rows.entries()) {
        const f = ri === 0 ? bold : font;
        const cellLines = Array.from({ length: cols }, (_, c) => wrap(row[c] ?? "", f, 9, cw - 8));
        const n = Math.max(...cellLines.map((c) => c.length));
        const h = n * 12 + 8;
        ensure(h);
        if (ri === 0) page.drawRectangle({ x: M, y: y - h + 4, width: CW, height: h, color: rgb(0.88, 0.95, 0.93) });
        page.drawLine({ start: { x: M, y: y - h + 4 }, end: { x: M + CW, y: y - h + 4 }, thickness: 0.4, color: rgb(0.75, 0.8, 0.8) });
        cellLines.forEach((cl, c) => cl.forEach((l, k) => page.drawText(l, { x: M + c * cw + 4, y: y - 8 - k * 12, size: 9, font: f, color: ink })));
        y -= h;
      }
      y -= 8;
    }
  }

  doc.getPages().forEach((p, i, all) => p.drawText(`Generated by Nova. Check important facts.  Page ${i + 1} of ${all.length}`, { x: M, y: 26, size: 8, font, color: rgb(0.5, 0.55, 0.55) }));
  const bytes = await doc.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(clean(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "nova-report").slice(0, 50)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
