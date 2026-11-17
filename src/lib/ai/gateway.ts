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

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
}

/** Streams the assistant's reply as text chunks. `onDone` receives the full reply and token counts. */
export async function streamChat(
  messages: ChatMessage[],
  onDone: (full: string, usage: Usage) => Promise<void> | void,
  opts: { signal?: AbortSignal; temperature?: number; maxTokens?: number } = {},
): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiNotConfigured();

  let upstream: Response | null = null;
  let status = 0;
  for (const model of aiModels()) {
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
type AgentMsg = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };

async function completeOnce(messages: AgentMsg[], tools: unknown[], opts: { signal?: AbortSignal; maxTokens: number; toolChoice?: "auto" | "none" }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiNotConfigured();
  let status = 0;
  for (const model of aiModels()) {
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
      console.error("Groq error", model, res.status, (await res.text().catch(() => "")).slice(0, 200));
      if (res.status === 400 && withTools) continue; // the model could not use tools: retry it without
      break;
    }
    if (![400, 404, 429, 503, 413].includes(status)) break;
  }
  throw new Error(status === 429 ? "The AI service is busy. Please try again in a moment." : "The AI service could not answer right now.");
}

export async function agentChat(
  messages: ChatMessage[],
  tools: unknown[],
  exec: (name: string, args: string) => Promise<{ content: string; blocks: Block[] }>,
  onDone: (full: string, usage: Usage, blocks: Block[]) => Promise<void> | void,
  opts: { signal?: AbortSignal; maxRounds?: number; maxTokens?: number } = {},
): Promise<ReadableStream<Uint8Array>> {
  const convo: AgentMsg[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  let text = "";
  const blocks: Block[] = [];
  for (let round = 0; round < (opts.maxRounds ?? 4); round++) {
    const last = round === (opts.maxRounds ?? 4) - 1;
    const { message, usage: u } = await completeOnce(convo, tools, { signal: opts.signal, maxTokens: opts.maxTokens ?? 900, toolChoice: last ? "none" : "auto" });
    usage.promptTokens = (usage.promptTokens ?? 0) + (u?.prompt_tokens ?? 0);
    usage.completionTokens = (usage.completionTokens ?? 0) + (u?.completion_tokens ?? 0);
    if (message.tool_calls?.length && !last) {
      convo.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
      // Independent tool calls run in parallel.
      const results = await Promise.all(message.tool_calls.map((c) => exec(c.function.name, c.function.arguments)));
      message.tool_calls.forEach((c, i) => {
        blocks.push(...results[i].blocks);
        convo.push({ role: "tool", tool_call_id: c.id, content: results[i].content });
      });
      continue;
    }
    text = (message.content ?? "").trim();
    break;
  }
  if (!text) text = blocks.length ? "Here is what I found." : "I could not put together an answer. Please try asking again.";
  const shown = blocks.slice(0, 4); // at most four visuals per answer

  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const b of shown) controller.enqueue(enc.encode(frame(b)));
      for (let i = 0; i < text.length; i += 48) controller.enqueue(enc.encode(text.slice(i, i + 48)));
      await onDone(text, usage, shown);
      controller.close();
    },
  });
}
