import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "@/lib/auth/rate-limit";
import { buildDocx } from "./docs/docx";
import { imageSearchConfigured, searchImages } from "./docs/images";
import { buildPptx } from "./docs/pptx";
import { DeckSpec, DocSpec, WorkbookSpec } from "./docs/spec";
import { saveGenerated } from "./docs/store";
import { buildXlsx } from "./docs/xlsx";
import { signAct, type ActKind } from "./act-token";
import type { ToolDef } from "./tools";

const ALL = ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"];
const TEACHERS = ["TEACHER"];
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const issues = (e: z.ZodError) => e.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");

/** A spec arrives either as an object or as a JSON string; both are accepted. */
function specOf(v: unknown): unknown {
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
  return v;
}

const SPEC_PARAM = (what: string) => ({ type: "object", properties: { spec: { type: "object", description: what } }, required: ["spec"], additionalProperties: false });

async function limited(userId: string) {
  return rateLimit(`aidocs:${userId}`, 12, 60 * 60_000, { failOpen: true });
}

export const DOC_TOOLS: ToolDef[] = [
  {
    name: "propose_plan",
    description:
      "Show the user a short plan and WAIT for their approval before doing multi-step or heavy work (a presentation, document, spreadsheet, several lookups, or anything that creates or changes data). Pass a title and 2 to 6 short step labels, and an optional agent name per step. After calling it, write one short line and STOP: do not call other tools until the user approves. Skip the plan for quick answers and when the user has just approved one.",
    parameters: { type: "object", properties: { title: { type: "string" }, steps: { type: "array", items: { type: "object", properties: { label: { type: "string" }, agent: { type: "string" } }, required: ["label"] } }, note: { type: "string" } }, required: ["title", "steps"], additionalProperties: false },
    roles: ALL,
    async run(_s, args) {
      const steps = (Array.isArray(args.steps) ? args.steps : []).map((x) => ({ label: str((x as Record<string, unknown>).label, 110), agent: str((x as Record<string, unknown>).agent, 30) || undefined })).filter((x) => x.label).slice(0, 6);
      if (steps.length < 2) return { data: { error: "A plan needs at least two steps." } };
      return { data: { shown: true, instruction: "The plan card with Approve is on screen. Say one short line and wait. Do not run the plan yet." }, blocks: [{ type: "plan", id: randomBytes(5).toString("hex"), title: str(args.title, 80) || "Plan", steps, note: str(args.note, 160) || undefined }] };
    },
  },
  {
    name: "ask_user",
    description:
      "Ask the user 1 to 4 short clarifying questions as a form card, ONLY when essential details are missing before you can plan or make something (for example topic and audience for a presentation). Give each question a key, a label and 2 to 5 option strings the user can tap, or leave options empty for free text. NEVER write questions as plain text or lists; always use this tool. After calling it, write at most one short line and STOP. Never use it after the user has approved a plan, and never ask twice for the same thing.",
    parameters: { type: "object", properties: { title: { type: "string" }, questions: { type: "array", items: { type: "object", properties: { key: { type: "string" }, label: { type: "string" }, options: { type: "array", items: { type: "string" } }, placeholder: { type: "string" } }, required: ["key", "label"] } } }, required: ["title", "questions"], additionalProperties: false },
    roles: ALL,
    async run(_s, args) {
      const questions = (Array.isArray(args.questions) ? args.questions : []).slice(0, 4).map((x) => {
        const o = x as Record<string, unknown>;
        return { key: str(o.key, 30) || "q", label: str(o.label, 120), options: (Array.isArray(o.options) ? o.options : []).map((v) => str(v, 40)).filter(Boolean).slice(0, 5), placeholder: str(o.placeholder, 60) || undefined };
      }).filter((q) => q.label);
      if (!questions.length) return { data: { error: "Give at least one question." } };
      return { data: { shown: true, instruction: "The question card is on screen. Say one short line and wait for the answers." }, blocks: [{ type: "ask", id: randomBytes(5).toString("hex"), title: str(args.title, 80) || "A few quick questions", questions: questions.map((q) => ({ ...q, options: q.options.length ? q.options : undefined })) }] };
    },
  },
  {
    name: "make_flashcards",
    description: "Student: create 6 to 10 short revision flashcards on one topic (today's lesson, a weak topic, or what the student names) and show them as a flip card with a Save button. Each card: front = a question or term (under 120 characters), back = a short answer (under 200 characters). Do not also write the cards as text.",
    parameters: { type: "object", properties: { topic: { type: "string" }, cards: { type: "array", items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"] } } }, required: ["topic", "cards"], additionalProperties: false },
    roles: ["STUDENT"],
    async run(_s, args) {
      const cards = (Array.isArray(args.cards) ? args.cards : []).slice(0, 12).map((x) => ({ front: str((x as Record<string, unknown>).front, 400), back: str((x as Record<string, unknown>).back, 600) })).filter((x) => x.front && x.back);
      if (cards.length < 3) return { data: { error: "Give at least 3 cards." } };
      return { data: { shown: true, count: cards.length, instruction: "The flashcards are on screen. Say one short line: tap to flip, save to keep them for spaced review." }, blocks: [{ type: "flashcards", topic: str(args.topic, 120) || "Revision", cards }] };
    },
  },
  {
    name: "find_images",
    description: "Search free online photos (Pexels, Unsplash) for a topic. Use only when the user asks for images or when a deck or document clearly benefits from them. Returns image URLs with credits; put a returned url in a slide or section as imageUrl. Never invent image URLs.",
    parameters: { type: "object", properties: { query: { type: "string" }, count: { type: "number", description: "1 to 6" } }, required: ["query"], additionalProperties: false },
    roles: ALL,
    async run(s, args) {
      if (!imageSearchConfigured()) return { data: { error: "Online image search is not configured. Continue without images." } };
      if (!(await limited(s.userId))) return { data: { error: "Too many requests. Try again later." } };
      const found = await searchImages(str(args.query, 100), Number(args.count) || 4);
      if (!found.length) return { data: { error: "No images found. Continue without images." } };
      return {
        data: { images: found.map((i) => ({ url: i.url, credit: i.credit, alt: i.alt })), note: "Use these exact urls as imageUrl and keep the credit text as imageCredit." },
        blocks: [{ type: "images", items: found.map((i) => ({ url: i.url, thumb: i.thumb, credit: i.credit, pageUrl: i.pageUrl, alt: i.alt })) }],
      };
    },
  },
  {
    name: "make_pptx",
    description:
      "Create a real PowerPoint (.pptx) with transitions and entrance animations, plus a live animated preview. Use only after the user approved the plan. spec = { title, subtitle?, author?, theme?{primary hex, accent hex, dark bool, font}, transition?(none|fade|push|wipe|zoom), animation?(none|fade|reveal), slides[1..30]{ layout(title|section|bullets|two-column|image-text|quote|chart|closing), title, subtitle?, bullets[]? (max 8, short), left[]?, right[]?, quote?, author?, imageUrl?, imageCredit?, chart?{type bar|line|pie, labels[], values[]}, notes?, transition?, animation? } }. Start with a title slide and end with a closing slide. Match colours and mood to the user's request.",
    parameters: SPEC_PARAM("The deck specification."),
    roles: ALL,
    async run(s, args) {
      const p = DeckSpec.safeParse(specOf(args.spec));
      if (!p.success) return { data: { error: `Invalid deck spec: ${issues(p.error)}` } };
      if (!(await limited(s.userId))) return { data: { error: "Too many documents this hour. Try again later." } };
      const d = p.data;
      const buf = await buildPptx(d);
      const f = await saveGenerated(s, d.title, "pptx", buf);
      return {
        data: { created: true, slides: d.slides.length, note: "The deck preview and download card are shown. Say one short line." },
        blocks: [
          { type: "deck", title: d.title, theme: { primary: d.theme.primary, accent: d.theme.accent, dark: d.theme.dark }, slides: d.slides.map((x) => ({ layout: x.layout, title: x.title, subtitle: x.subtitle ?? (x.layout === "title" ? d.subtitle : undefined), bullets: x.bullets, left: x.left, right: x.right, quote: x.quote, author: x.author, imageUrl: x.imageUrl, animation: x.animation ?? d.animation })) },
          { type: "file", fileId: f.fileId, name: f.name, kind: "pptx", size: f.size, detail: `${d.slides.length} slides · ${d.transition} transition · ${d.animation} animation` },
        ],
      };
    },
  },
  {
    name: "make_docx",
    description:
      "Create a Word (.docx) document. Use only after the user approved the plan. spec = { title, subtitle?, author?, theme?, toc?, footer?, sections[1..40]{ heading?, level(1-3), paragraphs[]?, bullets[]?, numbered[]?, table?{headers[], rows[][]}, imageUrl?, caption? } }. Good for lesson plans, worksheets, letters, circulars and reports.",
    parameters: SPEC_PARAM("The document specification."),
    roles: ALL,
    async run(s, args) {
      const p = DocSpec.safeParse(specOf(args.spec));
      if (!p.success) return { data: { error: `Invalid document spec: ${issues(p.error)}` } };
      if (!(await limited(s.userId))) return { data: { error: "Too many documents this hour. Try again later." } };
      const buf = await buildDocx(p.data);
      const f = await saveGenerated(s, p.data.title, "docx", buf);
      return { data: { created: true, sections: p.data.sections.length, note: "The download card is shown. Say one short line." }, blocks: [{ type: "file", fileId: f.fileId, name: f.name, kind: "docx", size: f.size, detail: `${p.data.sections.length} sections` }] };
    },
  },
  {
    name: "make_xlsx",
    description:
      "Create an Excel (.xlsx) workbook with LIVE formulas. Use only after the user approved the plan. spec = { title, theme?, sheets[1..8]{ name, title?, columns[]{header, format(text|number|integer|percent|date|currency), width?}, rows[][] (numbers, text, or formulas starting with '=' where {r} is the current row, e.g. '=SUM(B{r}:D{r})', '=IF(E{r}>=40,\"Pass\",\"Fail\")', '=RANK(E{r},E{first}:E{last})'), totals?{label, columns[] (0-based), fn SUM|AVERAGE|MIN|MAX|COUNT}, conditional?[]{column, rule below|above|scale, value?}, freezeHeader? } }. Put real data in the rows; use formulas for every computed column so the sheet stays live.",
    parameters: SPEC_PARAM("The workbook specification."),
    roles: ALL,
    async run(s, args) {
      const p = WorkbookSpec.safeParse(specOf(args.spec));
      if (!p.success) return { data: { error: `Invalid workbook spec: ${issues(p.error)}` } };
      if (!(await limited(s.userId))) return { data: { error: "Too many documents this hour. Try again later." } };
      let built;
      try { built = await buildXlsx(p.data); } catch (e) { return { data: { error: e instanceof Error ? e.message : "Could not build the workbook." } }; }
      const f = await saveGenerated(s, p.data.title, "xlsx", built.buffer);
      return { data: { created: true, formulas: built.formulas, note: "The download card is shown. Say one short line." }, blocks: [{ type: "file", fileId: f.fileId, name: f.name, kind: "xlsx", size: f.size, detail: `${p.data.sheets.length} sheet${p.data.sheets.length === 1 ? "" : "s"} · ${built.formulas} live formulas` }] };
    },
  },
  {
    name: "propose_action",
    description:
      "Propose a change to school data for the user to confirm with one click. NOTHING happens until they press Confirm. kinds: create_assignment (teacher; params: title, instructions, subjectId, divisionId, maxMarks, dueAt ISO, submissionType, allowLate, allowResubmission) saves a DRAFT; create_quiz (teacher; params: title, subjectId, divisionId, timeLimitMin, questions[{type MULTIPLE_CHOICE|TRUE_FALSE|SHORT_ANSWER, prompt, options[{label,isCorrect}], correctAnswer, explanation, points}]) saves a DRAFT; announce_class (teacher; params: divisionId, title, body) notifies the class; log_lesson (teacher; params: divisionId, subjectId, topic, summary, homework, date YYYY-MM-DD, default today) records what was taught so students' Copilot knows; add_portfolio (student; params: type, title, summary, occurredAt YYYY-MM-DD); mark_notifications_read. subjectId and divisionId must come from the user's own context via a lookup tool, never guessed. Give a plain-language title and 2 to 5 summary lines of exactly what will change.",
    parameters: { type: "object", properties: { kind: { type: "string", enum: ["create_assignment", "create_quiz", "announce_class", "log_lesson", "add_portfolio", "mark_notifications_read"] }, params: { type: "object" }, title: { type: "string" }, summary: { type: "array", items: { type: "string" } }, confirm: { type: "string", description: "Button label, e.g. Save draft" } }, required: ["kind", "params", "title", "summary"], additionalProperties: false },
    roles: ALL,
    async run(s, args) {
      const kind = str(args.kind, 40) as ActKind;
      const teacherOnly = ["create_assignment", "create_quiz", "announce_class", "log_lesson"].includes(kind);
      if (teacherOnly && !TEACHERS.includes(s.role)) return { data: { error: "That action is only available to teachers." } };
      if (kind === "add_portfolio" && s.role !== "STUDENT") return { data: { error: "Only students can add portfolio entries." } };
      if (!["create_assignment", "create_quiz", "announce_class", "log_lesson", "add_portfolio", "mark_notifications_read"].includes(kind)) return { data: { error: "Unknown action." } };
      const params = args.params && typeof args.params === "object" ? (args.params as Record<string, unknown>) : {};
      if (JSON.stringify(params).length > 30_000) return { data: { error: "Too much data." } };
      const summary = (Array.isArray(args.summary) ? args.summary : []).map((x) => str(x, 160)).filter(Boolean).slice(0, 5);
      return {
        data: { shown: true, instruction: "A confirmation card is on screen. Say one short line and wait. The change happens only when the user presses Confirm." },
        blocks: [{ type: "action", token: signAct(s.userId, kind, params), title: str(args.title, 90) || "Confirm this change", summary, confirm: str(args.confirm, 24) || "Confirm" }],
      };
    },
  },
];

export const DOC_LABELS: Record<string, { label: string; agent?: string }> = {
  ask_user: { label: "Preparing a few questions", agent: "Planner" },
  propose_plan: { label: "Drafting a plan for your approval", agent: "Planner" },
  make_flashcards: { label: "Writing revision cards", agent: "Flashcard agent" },
  find_images: { label: "Searching for photos", agent: "Image agent" },
  make_pptx: { label: "Designing and animating the slides", agent: "Slides agent" },
  make_docx: { label: "Writing and formatting the document", agent: "Docs agent" },
  make_xlsx: { label: "Building the spreadsheet and formulas", agent: "Sheets agent" },
  propose_action: { label: "Preparing the change for your confirmation", agent: "Action agent" },
};
