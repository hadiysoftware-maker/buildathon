import "server-only";
import {
  AlignmentType, Document, Footer, HeadingLevel, ImageRun, LevelFormat, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType, BorderStyle,
  type FileChild,
} from "docx";
import { loadImage } from "./images";
import type { DocSpecT } from "./spec";

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

export async function buildDocx(spec: DocSpecT): Promise<Buffer> {
  const { primary, accent, font } = spec.theme;
  const kids: FileChild[] = [];

  kids.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 120 }, children: [new TextRun({ text: spec.title, bold: true, size: 52, color: primary, font })] }));
  if (spec.subtitle) kids.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: spec.subtitle, size: 26, color: "5B6F6B", font })] }));
  if (spec.author) kids.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: spec.author, size: 20, color: "5B6F6B", font })] }));
  kids.push(new Paragraph({ border: { bottom: { color: accent, size: 12, style: BorderStyle.SINGLE, space: 1 } }, spacing: { after: 240 } }));
  if (spec.toc) kids.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }));

  for (const s of spec.sections) {
    if (s.heading) kids.push(new Paragraph({ heading: HEADINGS[s.level - 1], spacing: { before: 280, after: 100 }, children: [new TextRun({ text: s.heading, bold: true, color: primary, font })] }));
    for (const p of s.paragraphs ?? []) kids.push(new Paragraph({ spacing: { after: 140, line: 300 }, children: [new TextRun({ text: p, size: 22, font })] }));
    for (const b of s.bullets ?? []) kids.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: b, size: 22, font })] }));
    for (const n of s.numbered ?? []) kids.push(new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: n, size: 22, font })] }));
    if (s.table) {
      const cols = s.table.headers.length;
      const cell = (t: string, head: boolean) =>
        new TableCell({
          width: { size: Math.floor(9000 / cols), type: WidthType.DXA },
          shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: primary } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: t, bold: head, color: head ? "FFFFFF" : "1B2B29", size: 20, font })] })],
        });
      kids.push(new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [new TableRow({ tableHeader: true, children: s.table.headers.map((h) => cell(h, true)) }), ...s.table.rows.map((r) => new TableRow({ children: Array.from({ length: cols }, (_, i) => cell(r[i] ?? "", false)) }))],
      }));
      kids.push(new Paragraph({ spacing: { after: 160 } }));
    }
    if (s.imageUrl) {
      const img = await loadImage(s.imageUrl);
      if (img) {
        const w = 480;
        const h = Math.round((img.height / img.width) * w);
        kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: img.mime === "image/png" ? "png" : "jpg", data: img.bytes, transformation: { width: w, height: Math.min(h, 360) }, altText: { title: s.caption ?? "Image", description: s.caption ?? "Illustration", name: "image" } })] }));
        if (s.caption) kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: s.caption, italics: true, size: 18, color: "5B6F6B", font })] }));
      }
    }
  }

  const doc = new Document({
    creator: spec.author ?? "EduCore Copilot",
    title: spec.title,
    features: { updateFields: spec.toc },
    styles: { default: { document: { run: { font, size: 22 } } } },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1200, bottom: 1200, left: 1300, right: 1300 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${spec.footer ? spec.footer + "  ·  " : ""}Page `, size: 16, color: "5B6F6B", font }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "5B6F6B", font })] })] }) },
      children: kids,
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
