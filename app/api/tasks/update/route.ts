import { NextResponse } from "next/server";
import { appwriteRest } from "@/lib/appwrite/rest";
import { appwriteConfig } from "@/lib/appwrite/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/tasks/update
 * Atualiza uma tarefa diretamente no Appwrite via API Key (server-side).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, ...updates } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId é obrigatório" }, { status: 400 });
    }

    const dbId = appwriteConfig.databaseId;
    const collectionId = appwriteConfig.collections.tasks;

    const dataToUpdate: Record<string, any> = {};
    if (updates.status !== undefined) dataToUpdate.status = updates.status;
    if (updates.title !== undefined) dataToUpdate.title = updates.title;
    if (updates.priority !== undefined) dataToUpdate.priority = updates.priority;
    if (updates.description !== undefined) dataToUpdate.description = updates.description;
    if (updates.due_date !== undefined) dataToUpdate.due_date = updates.due_date;
    if (updates.metadata !== undefined) {
      dataToUpdate.metadata = typeof updates.metadata === "object" ? JSON.stringify(updates.metadata) : String(updates.metadata);
    }

    const updated = await appwriteRest.updateDocument(dbId, collectionId, taskId, dataToUpdate);

    return NextResponse.json({ task: { ...updated, id: updated.$id }, success: true });
  } catch (err: any) {
    console.error("[/api/tasks/update] Error:", err.message);
    return NextResponse.json({ error: err.message || "Erro ao atualizar tarefa" }, { status: 500 });
  }
}
