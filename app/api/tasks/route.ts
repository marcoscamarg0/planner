import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Busca rápida do projeto e tarefas diretamente
    const { data: project } = await supabase
      .from("projects")
      .select("id, parent_id")
      .eq("id", projectId)
      .maybeSingle();

    const targetIds = [projectId];
    if (project?.parent_id) targetIds.push(project.parent_id);

    let { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .in("project_id", targetIds)
      .order("created_at", { ascending: false });

    // Fallback rápido via admin caso vazio ou com erro de RLS
    if ((!tasks || tasks.length === 0 || tasksError) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminSupabase = await createServiceClient();
        const { data: adminTasks } = await adminSupabase
          .from("tasks")
          .select("*")
          .in("project_id", targetIds)
          .order("created_at", { ascending: false });
        if (adminTasks && adminTasks.length > 0) {
          tasks = adminTasks;
        }
      } catch (e) {}
    }

    return NextResponse.json({ tasks: tasks || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, tasks: [] }, { status: 500 });
  }
}
