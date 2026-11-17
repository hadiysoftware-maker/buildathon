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
  | { type: "summary"; title: string; points: string[]; next?: string };

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

export const packMessage = (text: string, blocks: Block[]) => (blocks.length ? ENV + JSON.stringify({ t: text, b: blocks }) : text);

export function unpackMessage(stored: string): { text: string; blocks: Block[] } {
  if (!stored.startsWith(ENV)) return { text: stored, blocks: [] };
  try {
    const j = JSON.parse(stored.slice(1)) as { t: string; b: Block[] };
    return { text: j.t, blocks: j.b ?? [] };
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
