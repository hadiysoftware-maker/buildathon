import "server-only";

/**
 * Outside research for the Copilot, used only after the user approves it. Sources are limited to:
 *  - the Wikipedia family (searched through the public MediaWiki API), and
 *  - pages on a short list of education sites that the user pastes (fetched with strict safety checks).
 * Nothing about the user or school is ever sent: only the search words.
 */
export interface Source { n: number; title: string; url: string; site: string; text: string }

const UA = "EduCoreCopilot/1.0 (education research)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;

/** Exact hosts and suffixes the Copilot may read. Anything else is refused. */
const SITES = [
  "wikipedia.org", "wikibooks.org", "wikiversity.org", "khanacademy.org", "britannica.com", "nasa.gov", "noaa.gov", "nih.gov",
  "who.int", "un.org", "unesco.org", "openstax.org", "ck12.org", "oercommons.org", "bbc.co.uk", "bbc.com", "nationalgeographic.com",
  "ncert.nic.in", "nic.in", "gov.in", "ac.in", "edu.in", "edu", "ac.uk", "gov", "edu.au",
];

export function allowedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(h) || /^\d+(\.\d+){3}$/.test(h) || !h.includes(".")) return false; // names only: no IPs, no localhost
  return SITES.some((s) => h === s || h.endsWith(`.${s}`));
}

export const siteList = () => "Wikipedia, Wikibooks, Wikiversity, Khan Academy, Britannica, NASA, NCERT, OpenStax, BBC, and .edu / .gov / .ac.in sites";

/** Validates a user-supplied address: https only, allowed host, no credentials or odd ports. */
export function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim().replace(/^http:\/\//i, "https://"));
    if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443") || !allowedHost(u.hostname)) return null;
    u.hash = "";
    return u;
  } catch { return null; }
}

async function getText(url: URL, accept: string): Promise<{ body: string; type: string; final: URL } | null> {
  let cur = url;
  for (let hop = 0; hop < 3; hop++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(cur, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": UA, accept } });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location") ? safeUrl(new URL(res.headers.get("location")!, cur).toString()) : null;
        if (!next) return null; // a redirect to a site that is not on the list is refused
        cur = next;
        continue;
      }
      if (!res.ok || !res.body) return null;
      const reader = res.body.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) { await reader.cancel(); break; }
        parts.push(value);
      }
      return { body: new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(parts)), type: res.headers.get("content-type") ?? "", final: cur };
    } catch { return null; } finally { clearTimeout(t); }
  }
  return null;
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === "#") { const c = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return c > 31 && c < 65536 ? String.fromCharCode(c) : " "; }
  return ENT[e.toLowerCase()] ?? " ";
});

/** Readable text of an HTML page: the main article when there is one, with scripts, menus and styles removed. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ")).trim().slice(0, 140);
  let body = html.match(/<(main|article)[\s\S]*?<\/\1>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  body = body.replace(/<(script|style|noscript|nav|header|footer|aside|form|svg|iframe)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  body = body.replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  const text = decode(body).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 40).join("\n");
  return { title, text };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, "")}...` : s);

type Page = { title: string; extract?: string; fullurl?: string; index?: number };
async function wikiPages(host: string, params: Record<string, string>): Promise<Page[]> {
  const u = new URL(`https://${host}/w/api.php`);
  u.search = new URLSearchParams({ action: "query", format: "json", prop: "extracts|info", exintro: "1", explaintext: "1", exlimit: "5", inprop: "url", redirects: "1", ...params }).toString();
  const r = await getText(u, "application/json");
  if (!r) return [];
  try { return Object.values((JSON.parse(r.body) as { query?: { pages?: Record<string, Page> } }).query?.pages ?? {}); } catch { return []; }
}

/** The article whose title best matches the topic (opensearch), plus full-text search hits. */
async function wiki(host: string, query: string, limit: number): Promise<Omit<Source, "n">[]> {
  const o = new URL(`https://${host}/w/api.php`);
  o.search = new URLSearchParams({ action: "opensearch", format: "json", search: query, limit: "1", redirects: "resolve" }).toString();
  const top = await getText(o, "application/json").then((r) => { try { return (JSON.parse(r?.body ?? "[]") as [string, string[]])[1]?.[0] ?? null; } catch { return null; } });
  const [exact, hits] = await Promise.all([
    top ? wikiPages(host, { titles: top }) : Promise.resolve([]),
    wikiPages(host, { generator: "search", gsrsearch: query, gsrlimit: String(limit), exlimit: String(limit) }),
  ]);
  const ordered = [...exact, ...hits.sort((a, b) => (a.index ?? 9) - (b.index ?? 9))];
  const seen = new Set<string>();
  return ordered
    .filter((p) => p.extract && p.fullurl && safeUrl(p.fullurl) && (seen.has(p.fullurl) ? false : (seen.add(p.fullurl), true)))
    .slice(0, limit)
    .map((p) => ({ title: p.title, url: p.fullurl!, site: host, text: clip(p.extract!.replace(/\s+/g, " "), 700) }));
}

/** Searches Wikipedia (English and Simple English) and reads any allowed pages the user gave. At most `max` sources. */
export async function research(query: string, urls: string[] = [], max = 4): Promise<Source[]> {
  const q = query.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  const given = urls.map(safeUrl).filter((u): u is URL => !!u).slice(0, 2);
  // Keep search hits that actually mention a key word of the question (drops off-topic matches).
  const STOP = new Set(["analyze", "analyse", "page", "give", "please", "tell", "article", "using", "https", "http", "wiki", "wikipedia", "summary", "summarise", "summarize", "what", "when", "where", "which", "about", "explain", "detailed", "depth", "with", "sources", "does", "have", "from", "that", "this", "work", "works", "how", "why", "the", "and", "for", "are", "is"]);
  const keys = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));
  const sq = keys.join(" ") || q;
  const wantsWiki = !given.length || q.length > 3;
  const [pages, en, simple] = await Promise.all([
    Promise.all(given.map(async (u) => {
      const r = await getText(u, "text/html,text/plain");
      if (!r || !/html|text/i.test(r.type)) return null;
      const d = htmlToText(r.body);
      return d.text.length > 80 ? { title: d.title || r.final.hostname, url: r.final.toString(), site: r.final.hostname.replace(/^www\./, ""), text: clip(d.text, 900) } : null;
    })),
    q && wantsWiki ? wiki("en.wikipedia.org", sq, given.length ? 2 : 3) : Promise.resolve([]),
    q && !given.length ? wiki("simple.wikipedia.org", sq, 1) : Promise.resolve([]),
  ]);
  const onTopic = (x: { title: string; text: string }) => (!keys.length ? !given.length : false) || keys.some((k) => `${x.title} ${x.text}`.toLowerCase().includes(k.slice(0, Math.max(4, k.length - 2))));
  const seen = new Set<string>();
  const all = [...pages.filter((x): x is NonNullable<typeof x> => !!x), ...en.filter(onTopic), ...simple.filter(onTopic)].filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  return all.slice(0, max).map((s, i) => ({ n: i + 1, ...s }));
}

/** Web addresses in a message, for the approval card. */
export function urlsIn(text: string): string[] {
  return [...new Set((text.match(/https?:\/\/[^\s)>\]"']+/gi) ?? []).map((x) => x.replace(/[.,;]+$/, "")))].slice(0, 3);
}
