import "server-only";
import { frame, type Block } from "./blocks";

/**
 * Groq AI gateway. The only place that talks to the model provider.
 *  - The API key lives in the server environment and never reaches the browser.
 *  - Callers pass role-scoped context; nothing here can read the database or call tools.
 *  - Responses stream back as plain text; token usage is reported through a callback for logging.
 */

export class AiNotConfigured extends Error {
  constructor() {
    super("The AI copilot is not configured yet. Ask an administrator to set GROQ_API_KEY.");
  }
}

export const aiConfigured = () => !!process.env.GROQ_API_KEY;
/** Comma-separated list in priority order; later models are used when an earlier one is rate-limited or unavailable. */
export const aiModels = () => (process.env.GROQ_MODEL || "allam-2-7b,openai/gpt-oss-20b").split(",").map((m) => m.trim()).filter(Boolean);
export const aiModel = () => aiModels()[0];

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[]; // parts are used only when images are attached
}

/** Models that can read images, in priority order. Text-only models cannot, so image questions use this chain. */
export const visionModels = () => (process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b").split(",").map((m) => m.trim()).filter(Boolean);

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
}

/** Streams the assistant's reply as text chunks. `onDone` receives the full reply and token counts. */
export async function streamChat(
  messages: ChatMessage[],
  onDone: (full: string, usage: Usage) => Promise<void> | void,
  opts: { signal?: AbortSignal; temperature?: number; maxTokens?: number; models?: string[] } = {},
): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiNotConfigured();

  let upstream: Response | null = null;
  let status = 0;
  for (const model of opts.models ?? aiModels()) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: opts.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
        temperature: opts.temperature ?? 0.4,
        max_completion_tokens: opts.maxTokens ?? 900,
      }),
    });
    if (res.ok && res.body) { upstream = res; break; }
    status = res.status;
    console.error("Groq error", model, res.status, (await res.text().catch(() => "")).slice(0, 200));
    if (![404, 429, 413, 503].includes(res.status)) break; // try the next model only for limit/availability problems
  }
  if (!upstream?.body) throw new Error(status === 429 ? "The AI service is busy. Please try again in a moment." : "The AI service could not answer right now.");

  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const reader = upstream.body!.getReader();
  let buf = "";
  let full = "";
  const usage: Usage = {};

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        await onDone(full, usage);
        controller.close();
        return;
      }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
            x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
          };
          const t = j.choices?.[0]?.delta?.content;
          if (t) {
            full += t;
            controller.enqueue(enc.encode(t));
          }
          const u = j.usage ?? j.x_groq?.usage;
          if (u) {
            usage.promptTokens = u.prompt_tokens;
            usage.completionTokens = u.completion_tokens;
          }
        } catch {
          /* ignore keep-alive or partial lines */
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Agent mode: the model may call read-only tools (see tools.ts) before answering. Tool rounds are not streamed (one
// short call each, low reasoning effort); the final answer is sent to the browser as soon as it is ready. Using the
// model's own final message (instead of a second streaming call) saves tokens.
// ---------------------------------------------------------------------------------------------------------------

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type AgentMsg = { role: "system" | "user" | "assistant" | "tool"; content: string | ContentPart[] | null; tool_calls?: ToolCall[]; tool_call_id?: string };

export async function completeOnce(messages: AgentMsg[], tools: unknown[], opts: { signal?: AbortSignal; maxTokens: number; toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } }; models?: string[] }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiNotConfigured();
  let status = 0;
  let limited = false;
  let daily = "";
  for (const model of opts.models ?? aiModels()) {
    for (const withTools of tools.length ? [true, false] : [false]) {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        signal: opts.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          ...(withTools ? { tools, tool_choice: opts.toolChoice ?? "auto" } : {}),
          ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
          temperature: 0.3,
          max_completion_tokens: opts.maxTokens,
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        return { message: j.choices?.[0]?.message ?? {}, usage: j.usage, model };
      }
      status = res.status;
      if (res.status === 429) limited = true;
      const errText = await res.text().catch(() => "");
      console.error("Groq error", model, res.status, errText.slice(0, 200));
      if (res.status === 429 && /tokens per day/i.test(errText)) daily = errText.match(/try again in ([0-9hms. ]+?)[.,]?\s*(?:Need|Please|"|$)/i)?.[1]?.trim() ?? "a few hours";
      if (res.status === 400 && withTools) continue; // the model could not use tools: retry it without
      break;
    }
    if (![400, 404, 429, 503, 413].includes(status)) break;
  }
  if (daily && status === 429) throw new Error(`Nova has used today's free AI allowance. Instant lookups (timetable, attendance, cards and so on) still work, and AI answers return in about ${daily}.`);
  throw new Error(status === 429 || limited ? "The AI service is busy. Please try again in a moment." : "The AI service could not answer right now.");
}

export async function agentChat(
  messages: ChatMessage[],
  tools: unknown[],
  exec: (name: string, args: string) => Promise<{ content: string; blocks: Block[] }>,
  onDone: (full: string, usage: Usage, blocks: Block[]) => Promise<void> | void,
  opts: { signal?: AbortSignal; maxRounds?: number; maxTokens?: number; models?: string[]; label?: (tool: string) => { label: string; agent?: string }; prefetch?: string[] } = {},
): Promise<ReadableStream<Uint8Array>> {
  const enc = new TextEncoder();
  // The stream is returned at once and the agent loop runs inside it, so the browser can show live progress ("Checking attendance...").
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (b: Block) => controller.enqueue(enc.encode(frame(b)));
      const convo: AgentMsg[] = messages.map((m) => ({ role: m.role, content: m.content }));
      const usage: Usage = { promptTokens: 0, completionTokens: 0 };
      const blocks: Block[] = [];
      let text = "";
      try {
        const rounds = opts.maxRounds ?? 5;
        emit({ type: "step", label: "Reading your message" });
        if (opts.prefetch?.length) {
          // One agent per topic, all at once. Their results are handed to the model as if it had called the tools itself.
          const calls = opts.prefetch.map((name, i) => ({ id: `pf${i}`, type: "function" as const, function: { name, arguments: "{}" } }));
          const meta = calls.map((c) => opts.label?.(c.function.name) ?? { label: c.function.name });
          meta.forEach((m) => emit({ type: "step", label: m.label, agent: m.agent }));
          const results = await Promise.all(calls.map(async (c, i) => {
            const r = await exec(c.function.name, "{}");
            emit({ type: "step", label: meta[i].label, agent: meta[i].agent, done: true });
            return r;
          }));
          convo.push({ role: "assistant", content: null, tool_calls: calls });
          calls.forEach((c, i) => { blocks.push(...results[i].blocks); convo.push({ role: "tool", tool_call_id: c.id, content: results[i].content }); });
          emit({ type: "step", label: "Combining what the agents found" });
        }
        for (let round = 0; round < rounds; round++) {
          const last = round === rounds - 1;
          const attempt = () => completeOnce(convo, tools, { signal: opts.signal, maxTokens: opts.maxTokens ?? 900, toolChoice: last ? "none" : "auto", models: opts.models });
          // The free tier allows 8,000 tokens a minute. When a heavy step hits that, wait a few seconds once instead of failing.
          const { message, usage: u } = await attempt().catch(async (e: unknown) => {
            if (!(e instanceof Error) || !/busy/i.test(e.message)) throw e;
            for (let wait = 0; wait < 3; wait++) {
              emit({ type: "step", label: "Waiting for the AI service to free up" });
              await new Promise((r) => setTimeout(r, 10000));
              try { return await attempt(); } catch (e2) { if (wait === 2 || !(e2 instanceof Error) || !/busy/i.test(e2.message)) throw e2; }
            }
            throw e;
          });
          usage.promptTokens = (usage.promptTokens ?? 0) + (u?.prompt_tokens ?? 0);
          usage.completionTokens = (usage.completionTokens ?? 0) + (u?.completion_tokens ?? 0);
          if (message.tool_calls?.length && !last) {
            convo.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
            const meta = message.tool_calls.map((c) => opts.label?.(c.function.name) ?? { label: c.function.name });
            // Agents work side by side: every start is announced at once and each one reports back the moment it finishes.
            meta.forEach((m) => emit({ type: "step", label: m.label, agent: m.agent }));
            const results = await Promise.all(message.tool_calls.map(async (c, i) => {
              const r = await exec(c.function.name, c.function.arguments);
              emit({ type: "step", label: meta[i].label, agent: meta[i].agent, done: true });
              return r;
            }));
            message.tool_calls.forEach((c, i) => {
              blocks.push(...results[i].blocks);
              convo.push({ role: "tool", tool_call_id: c.id, content: results[i].content });
            });
            emit({ type: "step", label: "Writing the answer" });
            continue;
          }
          text = (message.content ?? "").trim();
          break;
        }
        // An empty reply (no text, no cards) happens now and then. Ask once more, nudging towards a plan or a short answer.
        if (!text && !blocks.length) {
          try {
            const again = await completeOnce([...convo, { role: "user", content: "Reply now. If this needs a file, a change or several steps, call propose_plan. Otherwise answer in a few short sentences." }], tools, { signal: opts.signal, maxTokens: opts.maxTokens ?? 900, models: opts.models });
            const call = again.message.tool_calls?.[0];
            if (call) { const r = await exec(call.function.name, call.function.arguments); blocks.push(...r.blocks); text = (again.message.content ?? "").trim(); }
            else text = (again.message.content ?? "").trim();
          } catch { /* fall through to the default text */ }
        }
        // The model sometimes writes a quiz as plain text. Turn it into the interactive card instead.
        const quizSpec = (tools as { function?: { name?: string } }[]).find((t) => t.function?.name === "make_quiz");
        if (quizSpec && !blocks.some((b) => b.type === "quiz") && (text.match(/^\s*(?:[-*•]\s*)?\(?[a-d][).]\s+\S/gim) ?? []).length >= 4) {
          try {
            emit({ type: "step", label: "Turning the questions into a quiz card" });
            const fix = await completeOnce([...convo, { role: "assistant", content: text }, { role: "user", content: "Put exactly these questions into the interactive quiz card now by calling make_quiz. Give the 0-based index of the correct option and a one-line explanation for each." }], [quizSpec], { signal: opts.signal, maxTokens: 1800, toolChoice: { type: "function", function: { name: "make_quiz" } }, models: opts.models });
            const call = fix.message.tool_calls?.[0];
            if (call) {
              const r = await exec(call.function.name, call.function.arguments);
              if (r.blocks.some((b) => b.type === "quiz")) { blocks.push(...r.blocks); text = "Here is your practice quiz. Pick an answer for each question and I will track how you do."; }
            }
          } catch { /* keep the plain-text quiz */ }
        }
        // Same for flashcards written as "Q: ... A: ..." text.
        const flashSpec = (tools as { function?: { name?: string } }[]).find((t) => t.function?.name === "make_flashcards");
        if (flashSpec && !blocks.some((b) => b.type === "flashcards") && (text.match(/^\W*Q\s*[:.]/gim) ?? []).length >= 3) {
          try {
            emit({ type: "step", label: "Turning the cards into a flip deck" });
            const fix = await completeOnce([...convo, { role: "assistant", content: text }, { role: "user", content: "Put exactly these cards into the flashcard deck now by calling make_flashcards (front = the question, back = the answer, topic = the subject topic)." }], [flashSpec], { signal: opts.signal, maxTokens: 1500, toolChoice: { type: "function", function: { name: "make_flashcards" } }, models: opts.models });
            const call = fix.message.tool_calls?.[0];
            if (call) {
              const r = await exec(call.function.name, call.function.arguments);
              if (r.blocks.some((b) => b.type === "flashcards")) { blocks.push(...r.blocks); text = "Here are your flashcards. Tap a card to flip it, and save them to review later."; }
            }
          } catch { /* keep the text version */ }
        }
        if (!text) text = blocks.length ? "Here is what I found." : "I could not put together an answer. Please try asking again.";
        // At most four visuals per answer; a requested report always makes the cut.
        const KEEP = new Set(["report", "plan", "ask", "flashcards", "file", "deck", "action", "result", "research", "sources"]);
        const kept = blocks.filter((b) => KEEP.has(b.type)).slice(0, 4);
        const shown = [...blocks.filter((b) => !KEEP.has(b.type)).slice(0, 4 - kept.length), ...kept];
        // A card that waits for the user speaks for itself: keep only one short line beside it.
        if (shown.some((b) => b.type === "plan" || b.type === "ask" || b.type === "action" || b.type === "research")) text = text.split(/\n/)[0].slice(0, 160);
        for (const b of shown) emit(b);
        for (let i = 0; i < text.length; i += 48) controller.enqueue(enc.encode(text.slice(i, i + 48)));
        await onDone(text, usage, shown);
      } catch (e) {
        if ((e as Error).name !== "AbortError") controller.enqueue(enc.encode(e instanceof Error && /allowance/.test(e.message) ? e.message : "Sorry, the AI service could not answer just now. Please try again in a moment."));
      }
      controller.close();
    },
  });
}
