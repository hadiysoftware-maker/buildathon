import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { gradebookFor, teachesDivision } from "@/features/gradebook/data";
import { WorkbookSpec, DocSpec } from "@/lib/ai/docs/spec";
import { buildXlsx } from "@/lib/ai/docs/xlsx";
import { buildDocx } from "@/lib/ai/docs/docx";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Gradebook downloads for a class the signed-in teacher teaches.
 *   ?division=ID&format=xlsx            marks workbook with live formulas
 *   ?division=ID&format=docx&student=ID  one student's report card
 */
export async function GET(req: Request) {
  return handle(async () => {
    const s = await requirePermission("assignments.manage");
    const u = new URL(req.url);
    const divisionId = (u.searchParams.get("division") ?? "").slice(0, 30);
    if (!divisionId || !(await teachesDivision(s.userId, divisionId))) return NextResponse.json({ error: "Not your class." }, { status: 403 });
    const [div, rows] = await Promise.all([
      prisma.division.findFirst({ where: { id: divisionId }, select: { name: true, class: { select: { name: true } } } }),
      gradebookFor(s.institutionId, divisionId),
    ]);
    const cls = div ? `${div.class.name} ${div.name}` : "Class";
    const blank = (v: number | null) => (v === null ? null : v);

    if (u.searchParams.get("format") === "docx") {
      const r = rows.find((x) => x.studentId === u.searchParams.get("student"));
      if (!r) return NextResponse.json({ error: "Student not found in this class." }, { status: 404 });
      const pct = (v: number | null) => (v === null ? "Not available yet" : `${v}%`);
      const spec = DocSpec.parse({
        title: "Report card", subtitle: `${r.name} · ${cls} · ID ${r.code}`, author: s.user.fullName,
        footer: `Generated ${new Date().toLocaleDateString("en-IN")}`,
        sections: [
          { heading: "Summary", level: 1, table: { headers: ["Area", "Result", "Based on"], rows: [["Assignments (released marks)", pct(r.assignmentPct), `${r.assignments} graded`], ["Quizzes", pct(r.quizPct), `${r.quizzes} taken`], ["Attendance, last 30 days", pct(r.attendancePct), "excused days not counted"]] } },
          { heading: "Teacher comment", level: 1, paragraphs: ["(Add your comment here.)"] },
        ],
      });
      return new NextResponse(new Uint8Array(await buildDocx(spec)), { headers: { "content-type": DOCX, "content-disposition": `attachment; filename="report-${r.code}.docx"`, "cache-control": "private, no-store" } });
    }

    const spec = WorkbookSpec.parse({
      title: `Gradebook ${cls}`,
      sheets: [{
        name: "Gradebook", title: `${cls} gradebook`,
        columns: [{ header: "Student", width: 26 }, { header: "ID", width: 12 }, { header: "Assignments %", format: "number" }, { header: "Quizzes %", format: "number" }, { header: "Attendance %", format: "number" }, { header: "Overall %", format: "number" }, { header: "Status" }],
        rows: rows.map((r) => [r.name, r.code, blank(r.assignmentPct), blank(r.quizPct), blank(r.attendancePct), "=IF(COUNT(C{r}:E{r})=0,\"\",ROUND(AVERAGE(C{r}:E{r}),1))", "=IF(F{r}=\"\",\"No data\",IF(F{r}>=75,\"On track\",IF(F{r}>=50,\"Watch\",\"Needs support\")))"]),
        totals: { label: "Class average", columns: [2, 3, 4, 5], fn: "AVERAGE" },
        conditional: [{ column: 5, rule: "scale" }],
      }],
    });
    const { buffer } = await buildXlsx(spec);
    return new NextResponse(new Uint8Array(buffer as unknown as Buffer), { headers: { "content-type": XLSX, "content-disposition": `attachment; filename="gradebook-${cls.replace(/\s+/g, "-")}.xlsx"`, "cache-control": "private, no-store" } });
  });
}
