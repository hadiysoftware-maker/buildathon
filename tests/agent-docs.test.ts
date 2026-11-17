import { beforeAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { SaxesParser } from "saxes";
import { DeckSpec, DocSpec, WorkbookSpec, formulaOk } from "@/lib/ai/docs/spec";
import { isAllowedImageUrl } from "@/lib/ai/docs/images";
import { buildPptx } from "@/lib/ai/docs/pptx";
import { buildDocx } from "@/lib/ai/docs/docx";
import { buildXlsx } from "@/lib/ai/docs/xlsx";
import { readAct, signAct } from "@/lib/ai/act-token";

beforeAll(() => { process.env.SESSION_PEPPER = "test-pepper-0123456789abcdef"; });

describe("formula allow-list", () => {
  it("accepts normal spreadsheet formulas", () => {
    for (const f of ["=SUM(B2:D2)", '=IF(E2>=40,"Pass","Fail")', "=RANK(E2,E2:E30)", "=AVERAGE(B2:B30)*100"]) expect(formulaOk(f)).toBe(true);
  });
  it("rejects links, web calls and unknown functions", () => {
    for (const f of ['=HYPERLINK("http://x")', '=WEBSERVICE("http://x")', "=SUM([1]Sheet1!A1)", '=CALL("x")', "SUM(A1)"]) expect(formulaOk(f)).toBe(false);
  });
});

describe("image hosts", () => {
  it("only allows https Pexels and Unsplash image hosts", () => {
    expect(isAllowedImageUrl("https://images.pexels.com/photos/1/x.jpeg")).toBe(true);
    expect(isAllowedImageUrl("https://images.unsplash.com/photo-1")).toBe(true);
    expect(isAllowedImageUrl("http://images.pexels.com/x.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://evil.example.com/x.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://images.pexels.com.evil.com/x.jpg")).toBe(false);
  });
});

describe("signed Copilot actions", () => {
  it("binds the token to the user and expires", () => {
    const t = signAct("user1", "add_portfolio", { title: "x" });
    expect(readAct("user1", t)?.k).toBe("add_portfolio");
    expect(readAct("user2", t)).toBeNull();
    expect(readAct("user1", t.slice(0, -2) + "xx")).toBeNull();
    expect(readAct("user1", signAct("user1", "add_portfolio", {}, -1))).toBeNull();
  });
});

describe("file builders", () => {
  it("builds a pptx with slides, transitions and animations", async () => {
    const spec = DeckSpec.parse({
      title: "Water cycle",
      slides: [
        { layout: "title", title: "Water cycle", subtitle: "Class 6" },
        { layout: "bullets", title: "Stages", bullets: ["Evaporation", "Condensation", "Rain"], notes: "Say it slowly" },
        { layout: "chart", title: "Rain", chart: { type: "bar", labels: ["Jun", "Jul"], values: [10, 20] } },
        { layout: "closing", title: "Thanks" },
      ],
    });
    const zip = await JSZip.loadAsync(await buildPptx(spec));
    const slide2 = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(Object.keys(zip.files).filter((f) => /ppt\/slides\/slide\d+\.xml$/.test(f))).toHaveLength(4);
    for (let i = 1; i <= 4; i++) {
      const xml = await zip.file(`ppt/slides/slide${i}.xml`)!.async("string");
      const parser = new SaxesParser();
      let err: Error | null = null;
      parser.on("error", (e) => { err = e; });
      parser.write(xml).close();
      expect(err, `slide${i}.xml must be well-formed`).toBeNull();
    }
    expect(slide2).toContain("<p:transition");
    expect(slide2).toContain("<p:timing>");
    expect(slide2.indexOf("</p:clrMapOvr>")).toBeLessThan(slide2.indexOf("<p:transition"));
  });
  it("builds a docx", async () => {
    const buf = await buildDocx(DocSpec.parse({ title: "Lesson", toc: true, sections: [{ heading: "Aim", paragraphs: ["Learn."], bullets: ["a", "b"], table: { headers: ["x", "y"], rows: [["1", "2"]] } }] }));
    const zip = await JSZip.loadAsync(buf);
    expect(await zip.file("word/document.xml")!.async("string")).toContain("Lesson");
  });
  it("builds an xlsx with live formulas and a totals row", async () => {
    const spec = WorkbookSpec.parse({
      title: "Marks",
      sheets: [{
        name: "Marks",
        columns: [{ header: "Name" }, { header: "Maths", format: "integer" }, { header: "Science", format: "integer" }, { header: "Total", format: "integer" }, { header: "Result" }],
        rows: [["Asha", 80, 70, "=SUM(B{r}:C{r})", '=IF(D{r}>=100,"Pass","Fail")'], ["Ravi", 30, 40, "=SUM(B{r}:C{r})", '=IF(D{r}>=100,"Pass","Fail")']],
        totals: { columns: [1, 2, 3], fn: "SUM" },
        conditional: [{ column: 3, rule: "scale" }],
      }],
    });
    const { buffer, formulas } = await buildXlsx(spec);
    expect(formulas).toBe(7);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Marks")!;
    expect((ws.getCell("D2").value as { formula: string }).formula).toBe("SUM(B2:C2)");
    expect((ws.getCell("B4").value as { formula: string }).formula).toBe("SUM(B2:B3)");
  });
  it("refuses a workbook with a dangerous formula", async () => {
    const spec = WorkbookSpec.parse({ title: "x", sheets: [{ name: "S", columns: [{ header: "a" }], rows: [['=HYPERLINK("http://x")']] }] });
    await expect(buildXlsx(spec)).rejects.toThrow(/not allowed/);
  });
});
