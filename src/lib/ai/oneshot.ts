import "server-only";
import { completeOnce } from "./gateway";

/** One short, non-streaming model call (no tools). Waits and retries a few times when the free-tier rate limit is hit. */
export async function completeText(system: string, user: string, maxTokens = 400): Promise<string> {
  const msgs = [{ role: "system" as const, content: system }, { role: "user" as const, content: user }];
  for (let tryN = 0; ; tryN++) {
    try {
      const r = await completeOnce(msgs, [], { maxTokens });
      return (r.message.content ?? "").trim();
    } catch (e) {
      if (tryN >= 2 || !(e instanceof Error) || !/busy/i.test(e.message)) throw e;
      await new Promise((res) => setTimeout(res, 8000));
    }
  }
}
