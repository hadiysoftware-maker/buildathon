// One-off palette change: indigo/blue → teal. Run: node scripts/recolor.cjs
const fs = require("fs");
const path = require("path");

const HEX = {
  "#4B49AC": "#0F766E", "#3D3B94": "#115E59", "#3E3C94": "#0F5F59", "#323078": "#0B4A46",
  "#E8EFFF": "#E1F4F0", "#1B1A55": "#073B37", "#98BDFF": "#5EC4B6", "#7DA0FA": "#5EC4B6",
  "#7978E9": "#14B8A6", "#D9D7F8": "#CBEAE5", "#D0DFFF": "#BDE5DE",
  "#F5F7FC": "#F3F8F7", "#F4F7FC": "#F3F8F7", "#F0F4FC": "#EBF4F2", "#EAEFF8": "#E2EEEB", "#E2E7F2": "#D6E5E1",
  "#1E1E2F": "#12272A", "#64748B": "#527170", "#8492A6": "#7A9694",
  "#FAF9F6": "#F6FAF9", "#F8F6F0": "#F3F8F7", "#F3F1EA": "#ECF4F2", "#FFFFFC": "#FFFFFF", "#BEB7A4": "#B3C8C4",
};
const RGBA = [[/75,\s*73,\s*172/g, "15, 118, 110"], [/121,\s*120,\s*233/g, "20, 184, 166"], [/125,\s*160,\s*250/g, "94, 196, 182"], [/152,\s*189,\s*255/g, "94, 196, 182"]];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "generated") walk(p, out); }
    else if (/\.(css|tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const f of walk("src")) {
  let s = fs.readFileSync(f, "utf8");
  const o = s;
  s = s.replace(/#[0-9a-fA-F]{6}\b/g, (m) => HEX[m.toUpperCase()] ?? m);
  for (const [re, to] of RGBA) s = s.replace(re, to);
  if (s !== o) { fs.writeFileSync(f, s); changed++; console.log("recolored", f); }
}
console.log(changed, "files changed");
