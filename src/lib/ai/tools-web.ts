import "server-only";
import { randomBytes } from "node:crypto";
import { rateLimit } from "@/lib/auth/rate-limit";
import { research, safeUrl, siteList } from "./web";
import type { ToolDef } from "./tools";

const ALL = ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"];
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const WEB_TOOLS: ToolDef[] = [
  {
    name: "propose_research",
    description:
      "Ask the user to approve looking things up on trusted education sites. Use for big or in-depth questions, requests for sources or references, current or factual topics that school data cannot answer, and when the user pastes a web link to analyse. Pass the topic as short search words (for example 'photosynthesis in C4 plants', never instructions like 'analyze this') and any https links the user gave. Then write one short line and STOP: nothing is fetched until the user approves.",
    parameters: { type: "object", properties: { question: { type: "string" }, urls: { type: "array", items: { type: "string" } } }, required: ["question"], additionalProperties: false },
    roles: ALL,
    async run(_s, args) {
      const question = str(args.question, 200);
      if (question.length < 3) return { data: { error: "Give the question to research." } };
      const urls = (Array.isArray(args.urls) ? args.urls : []).map((u) => safeUrl(str(u, 300))?.toString()).filter((u): u is string => !!u).slice(0, 2);
      return {
        data: { shown: true, instruction: "The approval card is on screen. Say one short line and wait. Do not search yet." },
        blocks: [{ type: "research", id: randomBytes(5).toString("hex"), question, urls, sites: siteList() }],
      };
    },
  },
  {
    name: "web_research",
    description: "Look the question up on trusted education sites and return numbered sources. Only available after the user approved research. Call it once, then answer using only these sources and cite them as [1], [2].",
    parameters: { type: "object", properties: { query: { type: "string" }, urls: { type: "array", items: { type: "string" } } }, required: ["query"], additionalProperties: false },
    roles: ALL,
    async run(s, args) {
      if (!(await rateLimit(`aiweb:${s.userId}`, 10, 60 * 60_000, { failOpen: true }))) return { data: { error: "Too many research requests. Try again later." } };
      const query = str(args.query, 200);
      const urls = (Array.isArray(args.urls) ? args.urls : []).map((u) => str(u, 300));
      const found = await research(query, urls);
      if (!found.length) return { data: { error: "No trusted source had a useful page for this. Say so, and answer briefly from general knowledge, clearly marked as not from a source." } };
      return {
        data: { sources: found.map((x) => ({ n: x.n, title: x.title, site: x.site, text: x.text.slice(0, 480) })), note: "Cite as [n]. The source cards are shown; do not list the links again." },
        blocks: [{ type: "sources", query, items: found }],
      };
    },
  },
];

export const WEB_LABELS: Record<string, { label: string; agent?: string }> = {
  propose_research: { label: "Asking for your approval to research", agent: "Research agent" },
  web_research: { label: "Reading trusted education sites", agent: "Research agent" },
};
