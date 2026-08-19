import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const db = await createServiceClient();

    // Busca rápida do projeto e tarefas diretamente
    const { data: project } = await db
      .from("projects")
      .select("id, parent_id")
      .eq("id", projectId)
      .maybeSingle();

    const targetIds = Array.from(new Set([projectId, project?.id, project?.parent_id].filter(Boolean)));

    const { data: tasks } = await db
      .from("tasks")
      .select("*")
      .in("project_id", targetIds)
      .order("created_at", { ascending: false });

    return NextResponse.json({ tasks: tasks || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, tasks: [] }, { status: 500 });
  }
}
