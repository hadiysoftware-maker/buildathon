import "server-only";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { loadImage, type LoadedImage } from "./images";
import type { DeckSpecT } from "./spec";

const W = 13.333;
const H = 7.5;

function fit(img: LoadedImage, bw: number, bh: number) {
  const r = Math.min(bw / img.width, bh / img.height);
  const w = img.width * r;
  const h = img.height * r;
  return { w, h };
}

/** Builds the deck, then writes real PowerPoint transitions and entrance animations into the slide XML. */
export async function buildPptx(spec: DeckSpecT): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = spec.title;
  if (spec.author) pptx.author = spec.author;
  const { primary, accent, dark, font } = spec.theme;
  const bg = dark ? "0B1F1D" : "FFFFFF";
  const ink = dark ? "F4F7F6" : "1B2B29";
  const soft = dark ? "A9C2BE" : "5B6F6B";

  const images = new Map<string, LoadedImage | null>();
  await Promise.all([...new Set(spec.slides.map((s) => s.imageUrl).filter((u): u is string => !!u))].map(async (u) => images.set(u, await loadImage(u))));
  const put = (slide: PptxGenJS.Slide, url: string | undefined, x: number, y: number, bw: number, bh: number) => {
    const img = url ? images.get(url) : null;
    if (!img) return false;
    const { w, h } = fit(img, bw, bh);
    slide.addImage({ data: `${img.mime};base64,${img.bytes.toString("base64")}`, x: x + (bw - w) / 2, y: y + (bh - h) / 2, w, h });
    return true;
  };
  const bullets = (items: string[]) => items.map((t) => ({ text: t, options: { bullet: { code: "25CF" }, breakLine: true, paraSpaceAfter: 10 } }));

  spec.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    const hero = s.layout === "title" || s.layout === "section" || s.layout === "closing";
    slide.background = { color: hero ? primary : bg };
    const fg = hero ? "FFFFFF" : ink;

    if (hero) {
      slide.addShape("rect", { x: 0, y: H - 0.35, w: W, h: 0.35, fill: { color: accent } });
      slide.addText(s.title, { x: 0.9, y: 2.1, w: W - 1.8, h: 1.8, fontFace: font, fontSize: s.layout === "section" ? 40 : 46, bold: true, color: fg, valign: "bottom" });
      const sub = s.subtitle ?? (i === 0 ? spec.subtitle : undefined);
      if (sub) slide.addText(sub, { x: 0.9, y: 4.0, w: W - 1.8, h: 1.0, fontFace: font, fontSize: 22, color: "DDEFEA", valign: "top" });
      if (!put(slide, s.imageUrl, W - 4.4, 0.6, 3.8, 3.0) && i === 0 && spec.author) slide.addText(spec.author, { x: 0.9, y: 5.3, w: 8, h: 0.5, fontFace: font, fontSize: 16, color: "DDEFEA" });
    } else {
      slide.addShape("rect", { x: 0, y: 0, w: 0.25, h: H, fill: { color: primary } });
      slide.addText(s.title, { x: 0.8, y: 0.45, w: W - 1.6, h: 0.9, fontFace: font, fontSize: 32, bold: true, color: ink, valign: "middle" });
      slide.addShape("rect", { x: 0.8, y: 1.38, w: 1.4, h: 0.07, fill: { color: accent } });

      if (s.layout === "bullets") {
        const has = !!(s.imageUrl && images.get(s.imageUrl));
        slide.addText(bullets(s.bullets ?? []), { x: 0.8, y: 1.8, w: has ? 7.0 : W - 1.6, h: H - 2.6, fontFace: font, fontSize: 22, color: ink, valign: "top" });
        if (has) put(slide, s.imageUrl, 8.2, 1.8, 4.5, 4.4);
      } else if (s.layout === "two-column") {
        slide.addText(bullets(s.left ?? []), { x: 0.8, y: 1.8, w: 5.7, h: H - 2.6, fontFace: font, fontSize: 20, color: ink, valign: "top" });
        slide.addText(bullets(s.right ?? []), { x: 6.9, y: 1.8, w: 5.7, h: H - 2.6, fontFace: font, fontSize: 20, color: ink, valign: "top" });
      } else if (s.layout === "image-text") {
        const ok = put(slide, s.imageUrl, 0.8, 1.8, 5.6, 4.6);
        slide.addText(bullets(s.bullets ?? []), { x: ok ? 6.8 : 0.8, y: 1.8, w: ok ? 5.8 : W - 1.6, h: H - 2.6, fontFace: font, fontSize: 20, color: ink, valign: "top" });
      } else if (s.layout === "quote") {
        slide.addText(`“${s.quote ?? s.title}”`, { x: 1.2, y: 1.9, w: W - 2.4, h: 3.2, fontFace: "Georgia", fontSize: 32, italic: true, color: ink, valign: "middle" });
        if (s.author) slide.addText(`— ${s.author}`, { x: 1.2, y: 5.2, w: W - 2.4, h: 0.6, fontFace: font, fontSize: 18, color: soft, align: "right" });
      } else if (s.layout === "chart" && s.chart) {
        const t = s.chart.type === "pie" ? pptx.ChartType.pie : s.chart.type === "line" ? pptx.ChartType.line : pptx.ChartType.bar;
        const n = Math.min(s.chart.labels.length, s.chart.values.length);
        slide.addChart(t, [{ name: s.chart.title ?? s.title, labels: s.chart.labels.slice(0, n), values: s.chart.values.slice(0, n) }], {
          x: 1.2, y: 1.8, w: W - 2.4, h: H - 2.7, chartColors: [primary, accent, "2DD4BF", "6366F1", "F97316", "10B981", "EC4899", "64748B"],
          showLegend: s.chart.type === "pie", legendPos: "r", legendColor: ink, catAxisLabelColor: ink, valAxisLabelColor: ink, showValue: true, dataLabelColor: ink, valGridLine: { color: "D9E2E0", size: 0.5 },
        });
      }
      if (s.imageCredit) slide.addText(s.imageCredit, { x: 0.8, y: H - 0.5, w: W - 1.6, h: 0.3, fontFace: font, fontSize: 10, color: soft });
      slide.addText(String(i + 1), { x: W - 1.0, y: H - 0.5, w: 0.6, h: 0.3, fontFace: font, fontSize: 11, color: soft, align: "right" });
    }
    if (s.notes) slide.addNotes(s.notes);
  });

  const raw = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return addMotion(raw, spec);
}

const TRANSITIONS: Record<string, string> = {
  fade: '<p:transition spd="med"><p:fade/></p:transition>',
  push: '<p:transition spd="med"><p:push dir="u"/></p:transition>',
  wipe: '<p:transition spd="med"><p:wipe dir="r"/></p:transition>',
  zoom: '<p:transition spd="med"><p:zoom dir="in"/></p:transition>',
};

function timing(ids: string[], kind: "fade" | "reveal") {
  let n = 3;
  const effects = ids
    .map((id) => {
      const a = n++, b = n++, c = n++;
      const preset = kind === "fade" ? `presetID="10" presetClass="entr" presetSubtype="0"` : `presetID="22" presetClass="entr" presetSubtype="8"`;
      const filter = kind === "fade" ? "fade" : "wipe(left)";
      return `<p:par><p:cTn id="${a}" ${preset} fill="hold" nodeType="afterEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
        `<p:set><p:cBhvr><p:cTn id="${b}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${id}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>` +
        `<p:animEffect transition="in" filter="${filter}"><p:cBhvr><p:cTn id="${c}" dur="500"/><p:tgtEl><p:spTgt spid="${id}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`;
    })
    .join("");
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
    `<p:par><p:cTn id="${n}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="${n + 1}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par>` +
    `</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>` +
    `</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

/** Writes slide transitions and entrance animations (fade or reveal, one object after another) into the pptx XML. */
async function addMotion(buf: Buffer, spec: DeckSpecT): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf);
  for (let i = 0; i < spec.slides.length; i++) {
    const path = `ppt/slides/slide${i + 1}.xml`;
    const f = zip.file(path);
    if (!f) continue;
    let xml = await f.async("string");
    const s = spec.slides[i];
    const tr = s.transition ?? spec.transition;
    const an = s.animation ?? spec.animation;
    let extra = tr !== "none" ? TRANSITIONS[tr] ?? "" : "";
    if (an !== "none") {
      const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => m[1]).filter((id) => Number(id) >= 2);
      if (ids.length) extra += timing(ids.slice(0, 12), an);
    }
    if (extra && xml.includes("</p:sld>")) {
      xml = xml.replace("</p:sld>", `${extra}</p:sld>`);
      zip.file(path, xml);
    }
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
