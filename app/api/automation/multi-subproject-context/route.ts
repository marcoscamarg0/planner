import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const projectIds: string[] = Array.isArray(body.projectIds) ? body.projectIds.filter(Boolean) : [];

    if (projectIds.length === 0) {
      return NextResponse.json({ error: "Nenhum ID de projeto fornecido", subprojects: [] }, { status: 400 });
    }

    const db = await createServiceClient();

    // 1. Busca os projetos
    const { data: projectsData, error: projErr } = await db
      .from("projects")
      .select("id, title, description, color, emoji, target_url, status, parent_id, updated_at")
      .in("id", projectIds);

    if (projErr) throw projErr;

    // 2. Busca tarefas dos projetos selecionados
    const { data: tasksData } = await db
      .from("tasks")
      .select("id, project_id, title, description, status, priority, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    // 3. Busca páginas/requisitos dos projetos
    const { data: pagesData } = await db
      .from("pages")
      .select("id, project_id, title, content, order_index")
      .in("project_id", projectIds)
      .order("order_index", { ascending: true });

    // 4. Busca relatórios anteriores de QA
    const { data: reportsData } = await db
      .from("qa_reports")
      .select("id, project_id, type, title, result_json, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    // Monta o mapa estruturado
    const projectsList = projectsData || [];
    const tasks = tasksData || [];
    const pages = pagesData || [];
    const reports = reportsData || [];

    const subprojects = projectsList.map((proj) => {
      const projTasks = tasks.filter((t) => t.project_id === proj.id && t.status !== "cancelled");
      const projPages = pages.filter((p) => p.project_id === proj.id);
      const projReports = reports.filter((r) => r.project_id === proj.id);

      return {
        id: proj.id,
        title: proj.title,
        description: proj.description || "",
        emoji: proj.emoji || "📁",
        color: proj.color || "#6366f1",
        target_url: proj.target_url || null,
        status: proj.status,
        parent_id: proj.parent_id,
        tasks: projTasks,
        pages: projPages.map((p) => ({
          id: p.id,
          title: p.title,
          contentPreview: typeof p.content === "object" ? JSON.stringify(p.content).slice(0, 1000) : String(p.content || "").slice(0, 1000),
        })),
        reportsCount: projReports.length,
        lastReport: projReports[0] || null,
      };
    });

    return NextResponse.json({
      success: true,
      count: subprojects.length,
      subprojects,
    });
  } catch (err: any) {
    console.error("[multi-subproject-context] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao buscar contexto dos subprojetos" },
      { status: 500 }
    );
  }
}
