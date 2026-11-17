import { splitFrames, type Block } from "@/lib/ai/blocks";
import { BlockView } from "./Blocks";
import { Markdown } from "./Markdown";

/** One assistant reply: visuals first, then the text. `content` may still contain streaming frames. */
export function AssistantMessage({ content, blocks, pending }: { content: string; blocks?: Block[]; pending?: boolean }) {
  const parsed = splitFrames(content);
  const all = [...(blocks ?? []), ...parsed.blocks];
  return (
    <div className="ai-reply">
      {all.map((b, i) => <BlockView key={i} block={b} />)}
      {parsed.text ? <div className="cp-msg" data-role="ASSISTANT"><Markdown text={parsed.text} /></div> : pending && all.length === 0 ? <div className="cp-msg" data-role="ASSISTANT">Thinking…</div> : null}
    </div>
  );
}
