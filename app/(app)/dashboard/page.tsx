import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Visão geral dos seus projetos e tarefas",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  console.log("=========================================");
  console.log("[DB] Iniciando conexão com Supabase (Dashboard)...");
  const startTime = Date.now();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[DB ERROR] Falha na autenticação:", authError.message);
  }

  if (!user) redirect("/login");

  console.log(`[DB SUCCESS] Usuário autenticado em ${Date.now() - startTime}ms`);
  const queriesStartTime = Date.now();

  const [
    { data: profileData, error: profileError },
    { data: projects, error: projectsError }
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("*").eq("owner_id", user.id).neq("status", "archived").order("updated_at", { ascending: false })
  ]);
  
  let profile = profileData;

  if (!profile) {
    console.log("[DB] Profile não encontrado, executando auto-recovery...");
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: newProfile } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
      })
      .select()
      .single();

    if (newProfile) {
      profile = newProfile;
    }
  }

  if (profileError || projectsError) {
    console.error("[DB ERROR] Falha ao buscar dados principais:", profileError?.message || projectsError?.message);
  } else {
    console.log(`[DB SUCCESS] Projetos e perfil carregados em ${Date.now() - queriesStartTime}ms`);
  }

  const projectIds = (projects ?? []).map((p) => p.id);

  const [
    { data: tasks },
    { data: pages },
    { data: insights }
  ] = projectIds.length > 0
    ? await Promise.all([
        supabase.from("tasks").select("id, project_id, status").in("project_id", projectIds),
        supabase.from("pages").select("id, project_id").in("project_id", projectIds),
        supabase.from("ai_insights").select("id, project_id, content, type").in("project_id", projectIds).order("created_at", { ascending: false }).limit(50)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const projectsWithStats = (projects ?? []).map((project) => {
    const projectTasks = (tasks ?? []).filter(
      (t) => t.project_id === project.id
    );
    const projectPages = (pages ?? []).filter(
      (p) => p.project_id === project.id
    );
    const lastInsight = (insights ?? []).find(
      (i) => i.project_id === project.id
    );

    return {
      ...project,
      total_tasks: projectTasks.length,
      completed_tasks: projectTasks.filter((t) => t.status === "done").length,
      pages_count: projectPages.length,
      last_insight: lastInsight ?? null,
    };
  });

  const totalTasks = (tasks ?? []).length;
  const completedTasks = (tasks ?? []).filter((t) => t.status === "done").length;

  const stats = {
    total_projects: (projects ?? []).length,
    active_projects: (projects ?? []).filter((p) => p.status === "active").length,
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    completion_rate:
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };

  return (
    <DashboardClient
      profile={profile}
      projectsWithStats={projectsWithStats}
      allTasks={tasks ?? []}
      stats={stats}
    />
  );
}
