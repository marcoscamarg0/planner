import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { QaClient } from "./QaClient";

export const metadata = {
  title: "Qualidade & Testes | Planner",
  description: "Gere casos de teste, relatórios e scripts de automação com IA",
};

export default async function QaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("owner_id", user.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(20);

  return <QaClient projects={projects ?? []} />;
}
