import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/login";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSession().catch(() => null);
  redirect(s ? ROLE_HOME[s.role] : "/login");
}
