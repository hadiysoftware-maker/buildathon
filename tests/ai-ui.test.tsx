import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/components/ai/Markdown";
import { frame, packMessage, percents, splitFrames, unpackMessage, type Block } from "@/lib/ai/blocks";

describe("Markdown", () => {
  it("renders bold, lists and tables", () => {
    const html = renderToStaticMarkup(<Markdown text={"**Hi**\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |"} />);
    expect(html).toContain("<strong>Hi</strong>");
    expect(html).toContain("<li>a</li>");
    expect(html).toContain("<table");
    expect(html).not.toContain("**");
  });
  it("never outputs raw HTML or non-http links", () => {
    const html = renderToStaticMarkup(<Markdown text={'<img src=x onerror=alert(1)> [bad](javascript:alert(1)) [ok](https://example.com)'} />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('href="https://example.com"');
  });
});

describe("blocks", () => {
  it("percentages always add up to 100", () => {
    for (const v of [[1, 1, 1], [56, 0, 0], [33, 33, 34], [5, 7, 11, 13], [0, 0]]) {
      const p = percents(v);
      expect(p.reduce((a, b) => a + b, 0)).toBe(v.some((x) => x > 0) ? 100 : 0);
    }
  });
  it("splits finished frames from text and hides unfinished ones while streaming", () => {
    const b: Block = { type: "stats", items: [{ label: "A", value: 1 }] };
    const done = splitFrames(frame(b) + "Hello");
    expect(done.blocks).toEqual([b]);
    expect(done.text).toBe("Hello");
    const partial = splitFrames(frame(b) + "\u001e{\"type\":\"sum");
    expect(partial.blocks).toHaveLength(1);
    expect(partial.text).toBe("");
  });
  it("stores and restores messages with visuals", () => {
    const b: Block = { type: "summary", title: "T", points: ["p"] };
    expect(unpackMessage(packMessage("text", [b]))).toEqual({ text: "text", blocks: [b] });
    expect(unpackMessage("plain old message")).toEqual({ text: "plain old message", blocks: [] });
  });
});
