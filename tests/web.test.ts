import { describe, expect, it } from "vitest";
import { allowedHost, htmlToText, safeUrl, urlsIn } from "@/lib/ai/web";

describe("web research safety", () => {
  it("allows education hosts only", () => {
    expect(allowedHost("en.wikipedia.org")).toBe(true);
    expect(allowedHost("www.khanacademy.org")).toBe(true);
    expect(allowedHost("cs.stanford.edu")).toBe(true);
    expect(allowedHost("evil.com")).toBe(false);
    expect(allowedHost("wikipedia.org.evil.com")).toBe(false);
    expect(allowedHost("notwikipedia.org")).toBe(false);
    expect(allowedHost("localhost")).toBe(false);
    expect(allowedHost("127.0.0.1")).toBe(false);
  });
  it("accepts only clean https addresses", () => {
    expect(safeUrl("https://en.wikipedia.org/wiki/Photosynthesis")?.hostname).toBe("en.wikipedia.org");
    expect(safeUrl("http://en.wikipedia.org/wiki/X")?.protocol).toBe("https:");
    expect(safeUrl("https://user:pw@en.wikipedia.org/")).toBeNull();
    expect(safeUrl("https://en.wikipedia.org:8443/")).toBeNull();
    expect(safeUrl("https://169.254.169.254/latest")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
  });
  it("extracts readable text without scripts", () => {
    const r = htmlToText("<html><head><title>Cells &amp; tissues</title></head><body><nav>menu menu menu menu menu menu menu menu menu menu</nav><main><script>alert(1)</script><p>Cells are the basic unit of life and every organism is made of them.</p></main></body></html>");
    expect(r.title).toBe("Cells & tissues");
    expect(r.text).toContain("basic unit of life");
    expect(r.text).not.toContain("alert");
    expect(r.text).not.toContain("menu");
  });
  it("finds links in a message", () => {
    expect(urlsIn("read https://www.britannica.com/science/cell, please")).toEqual(["https://www.britannica.com/science/cell"]);
  });
});
