import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { appwriteRest } from "@/lib/appwrite/rest";
import { appwriteConfig } from "@/lib/appwrite/config";

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
    const rawIds: string[] = Array.isArray(body.projectIds)
      ? body.projectIds.map(String)
      : body.projectId
      ? [String(body.projectId)]
      : [];

    if (rawIds.length === 0) {
      return NextResponse.json({ error: "Informe os IDs dos projetos a serem excluídos." }, { status: 400 });
    }

    const db = await createServiceClient();
    const dbId = appwriteConfig.databaseId;

    // 1. Busca todos os projetos para encontrar subprojetos filhos e fazer match exato de IDs
    const projectsCol = appwriteConfig.collections.projects;
    const allProjDocs = await appwriteRest.fetchAllDocuments(dbId, projectsCol);

    const childIds: string[] = [];
    allProjDocs.forEach((p: any) => {
      if (rawIds.includes(p.parent_id) || rawIds.includes(p.parentId)) {
        if (p.$id) childIds.push(p.$id);
        if (p.id) childIds.push(p.id);
      }
    });

    const allProjectIdsToDelete = Array.from(new Set([...rawIds, ...childIds]));
    console.log(`[Delete Project API] Excluindo ${allProjectIdsToDelete.length} projeto(s)/subprojeto(s):`, allProjectIdsToDelete);

    // 2. Exclusão em cascata das dependências

    // 2.1 Tarefas
    try {
      const tasksCol = appwriteConfig.collections.tasks;
      const allTasks = await appwriteRest.fetchAllDocuments(dbId, tasksCol);
      for (const t of allTasks) {
        if (allProjectIdsToDelete.includes(t.project_id) || allProjectIdsToDelete.includes(t.projectId)) {
          await appwriteRest.deleteDocument(dbId, tasksCol, t.$id).catch(() => {});
        }
      }
      await db.from("tasks").delete().in("project_id", allProjectIdsToDelete);
    } catch (err) {
      console.warn("[Delete Project API] Aviso ao excluir tarefas vinculadas:", err);
    }

    // 2.2 Páginas / Documentação
    try {
      const pagesCol = appwriteConfig.collections.pages;
      const allPages = await appwriteRest.fetchAllDocuments(dbId, pagesCol);
      for (const p of allPages) {
        if (allProjectIdsToDelete.includes(p.project_id) || allProjectIdsToDelete.includes(p.projectId)) {
          await appwriteRest.deleteDocument(dbId, pagesCol, p.$id).catch(() => {});
        }
      }
      await db.from("pages").delete().in("project_id", allProjectIdsToDelete);
    } catch (err) {
      console.warn("[Delete Project API] Aviso ao excluir páginas vinculadas:", err);
    }

    // 2.3 Relatórios de QA
    try {
      const qaCol = appwriteConfig.collections.qaReports;
      const allQa = await appwriteRest.fetchAllDocuments(dbId, qaCol);
      for (const q of allQa) {
        if (allProjectIdsToDelete.includes(q.project_id) || allProjectIdsToDelete.includes(q.projectId)) {
          await appwriteRest.deleteDocument(dbId, qaCol, q.$id).catch(() => {});
        }
      }
      await db.from("qa_reports").delete().in("project_id", allProjectIdsToDelete);
    } catch (err) {
      console.warn("[Delete Project API] Aviso ao excluir relatórios vinculados:", err);
    }

    // 2.4 Insights IA
    try {
      const insCol = appwriteConfig.collections.insights;
      const allIns = await appwriteRest.fetchAllDocuments(dbId, insCol);
      for (const i of allIns) {
        if (allProjectIdsToDelete.includes(i.project_id) || allProjectIdsToDelete.includes(i.projectId)) {
          await appwriteRest.deleteDocument(dbId, insCol, i.$id).catch(() => {});
        }
      }
      await db.from("ai_insights").delete().in("project_id", allProjectIdsToDelete);
    } catch (err) {
      console.warn("[Delete Project API] Aviso ao excluir insights vinculados:", err);
    }

    // 3. Exclusão direta e garantida dos próprios projetos no Appwrite
    for (const pid of allProjectIdsToDelete) {
      try {
        await appwriteRest.deleteDocument(dbId, projectsCol, pid);
      } catch {}

      const matches = allProjDocs.filter((d: any) => d.$id === pid || d.id === pid);
      for (const m of matches) {
        try {
          await appwriteRest.deleteDocument(dbId, projectsCol, m.$id);
        } catch {}
      }
    }

    // Chamada de garantia pelo adapter
    try {
      await db.from("projects").delete().in("id", allProjectIdsToDelete);
    } catch {}

    return NextResponse.json({
      success: true,
      deletedIds: allProjectIdsToDelete,
      count: allProjectIdsToDelete.length,
    });
  } catch (err: any) {
    console.error("[Delete Project API Error]:", err);
    return NextResponse.json({
      error: err.message || "Erro ao excluir projeto e dependências",
    }, { status: 500 });
  }
}
