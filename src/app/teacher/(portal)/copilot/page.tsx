import { requirePagePermission } from "@/lib/auth/guards";
import { CopilotPage } from "@/features/ai/copilot-page";

export const metadata = { title: "AI Copilot · EduCore" };

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const s = await requirePagePermission("ai.use", "/teacher/login");
  return <CopilotPage s={s} searchParams={searchParams} base="/teacher/copilot" eyebrow="Teaching" />;
}
