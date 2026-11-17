/**
 * Visual blocks the Copilot can show next to its text. They are built on the server from real query results (never
 * written by the model, except the summary card), sent to the browser as framed JSON, and stored with the message.
 */
export type Block =
  | { type: "stats"; items: { label: string; value: number | string }[] }
  | { type: "donut"; title: string; slices: { label: string; value: number }[] }
  | { type: "bar"; title: string; rows: { label: string; value: number }[] }
  | { type: "students"; items: { name: string; code: string; cls: string; status: string; href?: string }[] }
  | { type: "teachers"; items: { name: string; code: string; role?: string; status: string; subjects: string[]; classes: number }[] }
  | { type: "timeline"; date: string; rows: { time: string; title: string; sub?: string; state: string }[] }
  | { type: "materials"; items: { title: string; subject: string; kind: string; size: string; status: string; href?: string }[] }
  | { type: "links"; items: { label: string; href: string; hint?: string }[] }
  | { type: "summary"; title: string; points: string[]; next?: string }
  | { type: "quiz"; title: string; questions: { q: string; options: string[]; answer: number; why?: string }[] }
  | { type: "report"; title: string; markdown: string }
  | { type: "plan"; id: string; title: string; steps: { label: string; agent?: string }[]; note?: string }
  | { type: "file"; fileId: string; name: string; kind: "pptx" | "docx" | "xlsx"; size: number; detail?: string }
  | { type: "deck"; title: string; theme: { primary: string; accent: string; dark: boolean }; slides: { layout: string; title: string; subtitle?: string; bullets?: string[]; left?: string[]; right?: string[]; quote?: string; author?: string; imageUrl?: string; animation?: string }[] }
  | { type: "ask"; id: string; title: string; questions: { key: string; label: string; options?: string[]; placeholder?: string }[] }
  | { type: "flashcards"; topic: string; cards: { front: string; back: string }[] }
  | { type: "action"; token: string; title: string; summary: string[]; confirm: string }
  | { type: "result"; title: string; items: { label: string; value: string }[]; links?: { label: string; href: string }[] }
  | { type: "images"; items: { url: string; thumb: string; credit: string; pageUrl: string; alt: string }[] }
  | { type: "research"; id: string; question: string; urls: string[]; sites: string }
  | { type: "sources"; query: string; items: { n: number; title: string; url: string; site: string; text: string }[] }
  | { type: "step"; label: string; done?: boolean; agent?: string }; // live progress only, never stored

const FS = "\u001e"; // record separator: frames a block inside the text stream
const ENV = "␞"; // marks a stored message that carries blocks

export const frame = (b: Block) => `${FS}${JSON.stringify(b)}${FS}`;

/** Splits a (possibly still streaming) reply into finished blocks and the remaining text. */
export function splitFrames(raw: string): { blocks: Block[]; text: string } {
  const blocks: Block[] = [];
  let text = "";
  let i = 0;
  for (;;) {
    const a = raw.indexOf(FS, i);
    if (a < 0) { text += raw.slice(i); break; }
    text += raw.slice(i, a);
    const b = raw.indexOf(FS, a + 1);
    if (b < 0) break; // frame not finished yet: hide it until it is
    try { blocks.push(JSON.parse(raw.slice(a + 1, b)) as Block); } catch { /* skip a damaged frame */ }
    i = b + 1;
  }
  return { blocks, text: text.trimStart() };
}

export interface AttachedFile { id: string; name: string; mime: string }

/** Stored form of a message. Files and the text pulled out of them ride along so follow-up questions can reuse them. */
export const packMessage = (text: string, blocks: Block[], extra?: { files?: AttachedFile[]; x?: string }) =>
  blocks.length || extra?.files?.length ? ENV + JSON.stringify({ t: text, b: blocks, ...(extra?.files?.length ? { f: extra.files, x: extra.x } : {}) }) : text;

export function unpackMessage(stored: string): { text: string; blocks: Block[]; files?: AttachedFile[]; x?: string } {
  if (!stored.startsWith(ENV)) return { text: stored, blocks: [] };
  try {
    const j = JSON.parse(stored.slice(1)) as { t: string; b: Block[]; f?: AttachedFile[]; x?: string };
    return { text: j.t, blocks: j.b ?? [], files: j.f, x: j.x };
  } catch {
    return { text: stored, blocks: [] };
  }
}

/** Share of the whole for each slice, as whole percents that add up to exactly 100. */
export function percents(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  let rest = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k].i]++;
  return out;
}
