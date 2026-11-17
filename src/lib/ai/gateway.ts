import "server-only";

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
