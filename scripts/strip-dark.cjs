// One-off: removes every dark-theme rule from the supplied CSS. Run: node scripts/strip-dark.cjs
const fs = require("fs");

const isDarkSel = (s) => /html\.dark|\.dark\b|data-theme\s*=\s*['"]dark['"]|prefers-color-scheme:\s*dark/.test(s);

function splitTop(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function process(css) {
  let out = ""; let i = 0;
  while (i < css.length) {
    // copy comments verbatim
    if (css.startsWith("/*", i)) { const e = css.indexOf("*/", i) + 2; out += css.slice(i, e); i = e; continue; }
    const open = css.indexOf("{", i);
    const semi = css.indexOf(";", i);
    if (open === -1) { out += css.slice(i); break; }
    if (semi !== -1 && semi < open) { out += css.slice(i, semi + 1); i = semi + 1; continue; } // at-rule like @import / @config
    const rawPrelude = css.slice(i, open);
    const lead = (rawPrelude.match(/^(\s*\/\*[\s\S]*?\*\/)*\s*/) || [""])[0];
    const prelude = rawPrelude.slice(lead.length);
    out += lead;
    // find matching close
    let depth = 1, j = open + 1;
    while (j < css.length && depth > 0) {
      if (css.startsWith("/*", j)) { j = css.indexOf("*/", j) + 2; continue; }
      if (css[j] === "{") depth++;
      if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    const trimmed = prelude.trim();
    if (trimmed.startsWith("@")) {
      if (isDarkSel(trimmed)) { i = j; continue; }
      const inner = /^@(media|supports|layer|container)/.test(trimmed) ? process(body) : body;
      if (/^@(media|supports|layer|container)/.test(trimmed) && inner.trim() === "") { i = j; continue; }
      out += prelude + "{" + inner + "}"; i = j; continue;
    }
    const parts = splitTop(prelude);
    const keep = parts.filter((p) => !isDarkSel(p));
    if (keep.length === 0) { i = j; continue; }
    out += (keep.length === parts.length ? prelude : "\n" + keep.map((p) => p.trim()).join(",\n")) + "{" + body + "}";
    i = j;
  }
  return out;
}

for (const f of ["src/app/globals.css", "src/app/dashboard.css"]) {
  const before = fs.readFileSync(f, "utf8");
  const after = process(before).replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(f, after);
  console.log(f, before.length, "→", after.length, "dark refs left:", (after.match(/\.dark|data-theme\s*=\s*['"]dark/g) || []).length);
}
