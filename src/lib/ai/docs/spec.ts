import { z } from "zod";

const hex = z.string().regex(/^#?[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour").transform((v) => v.replace("#", "").toUpperCase());
const text = (n: number) => z.string().trim().max(n);

export const Theme = z.object({
  primary: hex.default("0F766E"),
  accent: hex.default("F59E0B"),
  dark: z.boolean().default(false),
  font: z.enum(["Calibri", "Arial", "Georgia", "Verdana", "Trebuchet MS"]).default("Calibri"),
});

export const Transition = z.enum(["none", "fade", "push", "wipe", "zoom"]);
export const Animation = z.enum(["none", "fade", "reveal"]);

export const Slide = z.object({
  layout: z.enum(["title", "section", "bullets", "two-column", "image-text", "quote", "chart", "closing"]),
  title: text(120),
  subtitle: text(200).optional(),
  bullets: z.array(text(220)).max(8).optional(),
  left: z.array(text(180)).max(6).optional(),
  right: z.array(text(180)).max(6).optional(),
  quote: text(300).optional(),
  author: text(80).optional(),
  imageUrl: text(600).optional(),
  imageCredit: text(160).optional(),
  chart: z.object({ type: z.enum(["bar", "line", "pie"]), title: text(80).optional(), labels: z.array(text(40)).min(2).max(12), values: z.array(z.number()).min(2).max(12) }).optional(),
  notes: text(1200).optional(),
  transition: Transition.optional(),
  animation: Animation.optional(),
});

export const DeckSpec = z.object({
  title: text(120),
  subtitle: text(200).optional(),
  author: text(80).optional(),
  theme: Theme.default({ primary: "0F766E", accent: "F59E0B", dark: false, font: "Calibri" }),
  transition: Transition.default("fade"),
  animation: Animation.default("fade"),
  slides: z.array(Slide).min(1).max(30),
});
export type DeckSpecT = z.output<typeof DeckSpec>;

export const DocSection = z.object({
  heading: text(140).optional(),
  level: z.number().int().min(1).max(3).default(1),
  paragraphs: z.array(text(2500)).max(12).optional(),
  bullets: z.array(text(300)).max(15).optional(),
  numbered: z.array(text(300)).max(15).optional(),
  table: z.object({ headers: z.array(text(60)).min(1).max(8), rows: z.array(z.array(text(160)).max(8)).max(40) }).optional(),
  imageUrl: text(600).optional(),
  caption: text(160).optional(),
});
export const DocSpec = z.object({
  title: text(140),
  subtitle: text(200).optional(),
  author: text(80).optional(),
  theme: Theme.default({ primary: "0F766E", accent: "F59E0B", dark: false, font: "Calibri" }),
  toc: z.boolean().default(false),
  footer: text(120).optional(),
  sections: z.array(DocSection).min(1).max(40),
});
export type DocSpecT = z.output<typeof DocSpec>;

/** A cell is a number, text, or a formula string starting with "=" (use {r} for the current row number). */
const Cell = z.union([z.number(), z.string().max(400), z.null()]);
export const SheetSpec = z.object({
  name: text(31).default("Sheet1"),
  title: text(120).optional(),
  columns: z.array(z.object({ header: text(60), width: z.number().min(6).max(60).optional(), format: z.enum(["text", "number", "integer", "percent", "date", "currency"]).default("text") })).min(1).max(20),
  rows: z.array(z.array(Cell).max(20)).max(500),
  totals: z.object({ label: text(40).default("Total"), columns: z.array(z.number().int().min(0).max(19)).max(20), fn: z.enum(["SUM", "AVERAGE", "MIN", "MAX", "COUNT"]).default("SUM") }).optional(),
  conditional: z.array(z.object({ column: z.number().int().min(0).max(19), rule: z.enum(["below", "above", "scale"]), value: z.number().optional() })).max(6).optional(),
  freezeHeader: z.boolean().default(true),
});
export const WorkbookSpec = z.object({
  title: text(120),
  theme: Theme.default({ primary: "0F766E", accent: "F59E0B", dark: false, font: "Calibri" }),
  sheets: z.array(SheetSpec).min(1).max(8),
});
export type WorkbookSpecT = z.output<typeof WorkbookSpec>;

/** Formulas the Sheets agent may write. Anything else (external links, macros, web calls) is rejected. */
const FUNCS = new Set(["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA", "IF", "IFS", "ROUND", "ROUNDUP", "ROUNDDOWN", "RANK", "VLOOKUP", "XLOOKUP", "INDEX", "MATCH", "SUMIF", "SUMIFS", "COUNTIF", "COUNTIFS", "AVERAGEIF", "TEXT", "AND", "OR", "NOT", "ABS", "IFERROR", "MEDIAN", "LARGE", "SMALL", "PRODUCT", "TODAY", "CONCATENATE", "LEFT", "RIGHT", "LEN", "UPPER", "LOWER"]);
export function formulaOk(f: string): boolean {
  if (!f.startsWith("=") || f.length > 400) return false;
  if (/\[|https?:|\\\\|@|!\s*\w+\(/i.test(f)) return false;
  const names = f.toUpperCase().match(/[A-Z][A-Z0-9.]*(?=\()/g) ?? [];
  return names.every((n) => FUNCS.has(n));
}
