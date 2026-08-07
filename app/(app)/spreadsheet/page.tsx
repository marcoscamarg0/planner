import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SpreadsheetClient } from "./SpreadsheetClient";

export const metadata = {
  title: "Gerador de Planilhas | Planner",
  description: "Gere planilhas com os dados dos seus projetos.",
};

export default async function SpreadsheetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all projects for the user
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />
      
      <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        <SpreadsheetClient initialProjects={projects || []} />
      </div>
    </div>
  );
}
