import { Fragment, type ReactNode } from "react";

/**
 * Small, safe markdown renderer for assistant replies. It builds React elements only (never raw HTML), supports
 * headings, bold, italics, inline code, bullet and numbered lists, simple tables and http(s) links.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const key = `${keyBase}-${n++}`;
    if (t.startsWith("**")) out.push(<strong key={key}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={key}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const [, label, href] = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(t) ?? [];
      out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>);
    } else out.push(<em key={key}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const els: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (isRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = cells(line);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && isRow(lines[i])) body.push(cells(lines[i++]));
      els.push(
        <div key={k++} className="ai-table-wrap">
          <table className="ai-table">
            <thead><tr>{head.map((h, c) => <th key={c}>{inline(h, `h${c}`)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `c${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { els.push(<p key={k++} className="ai-h">{inline(h[2], `h${k}`)}</p>); i++; continue; }

    if (/^\s*([-*•])\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/.test(lines[i]) : /^\s*([-*•])\s+/.test(lines[i]))) {
        items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*([-*•])\s+/, ""));
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      els.push(<Tag key={k++} className="ai-list">{items.map((t, n) => <li key={n}>{inline(t, `l${k}-${n}`)}</li>)}</Tag>);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isRow(lines[i]) && !/^(#{1,4})\s+/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) para.push(lines[i++]);
    els.push(
      <p key={k++} className="ai-p">
        {para.map((t, n) => <Fragment key={n}>{n > 0 && <br />}{inline(t, `p${k}-${n}`)}</Fragment>)}
      </p>,
    );
  }
  return <div className="ai-md">{els}</div>;
}
