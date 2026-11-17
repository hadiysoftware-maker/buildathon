import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvObjects, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("parses quotes, commas, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b,c","d ""q"""\r\n1,2,3\n')).toEqual([["a", "b,c", 'd "q"'], ["1", "2", "3"]]);
  });
  it("skips blank lines and BOM", () => {
    expect(parseCsv("﻿a,b\n\n,\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
  it("maps headers case-insensitively", () => {
    expect(parseCsvObjects("FullName, Email \nAnu,a@x.in")).toEqual([{ fullname: "Anu", email: "a@x.in" }]);
  });
  it("round-trips and neutralises formula injection", () => {
    const out = toCsv([["name", "note"], ["=SUM(1)", 'has "quote", comma']]);
    expect(out).toBe("name,note\r\n'=SUM(1),\"has \"\"quote\"\", comma\"");
    expect(parseCsv(out)[1][1]).toBe('has "quote", comma');
  });
});
