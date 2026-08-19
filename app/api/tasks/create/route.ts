import { NextResponse } from "next/server";
import { appwriteRest } from "@/lib/appwrite/rest";
import { appwriteConfig } from "@/lib/appwrite/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/create
 * Cria uma tarefa diretamente no Appwrite via API Key (server-side),
 * evitando problemas de permissão "users" no client-side.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      project_id,
      title,
      description,
      status = "todo",
      priority = "medium",
      due_date,
      parent_task_id,
      metadata,
    } = body;

    if (!project_id || !title) {
      return NextResponse.json(
        { error: "project_id e title são obrigatórios" },
        { status: 400 }
      );
    }

    const dbId = appwriteConfig.databaseId;
    const collectionId = appwriteConfig.collections.tasks;
    const docId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const data: Record<string, any> = {
      project_id,
      title,
      status,
      priority,
    };

    if (description !== undefined && description !== null) {
      data.description = String(description).slice(0, 4000);
    }
    if (due_date) data.due_date = due_date;
    if (parent_task_id) data.parent_task_id = parent_task_id;
    if (metadata) {
      data.metadata = typeof metadata === "object" ? JSON.stringify(metadata) : String(metadata);
    }

    const created = await appwriteRest.createDocument(dbId, collectionId, docId, data);

    return NextResponse.json({ task: { ...created, id: created.$id }, success: true });
  } catch (err: any) {
    console.error("[/api/tasks/create] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Erro ao criar tarefa" },
      { status: 500 }
    );
  }
}
