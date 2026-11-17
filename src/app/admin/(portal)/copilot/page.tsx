import { requirePagePermission } from "@/lib/auth/guards";
import { CopilotPage } from "@/features/ai/copilot-page";

export const metadata = { title: "AI Copilot · Campus 2035" };

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const s = await requirePagePermission("ai.use", "/admin/login");
  return <CopilotPage s={s} searchParams={searchParams} base="/admin/copilot" eyebrow="Assistant" />;
}
