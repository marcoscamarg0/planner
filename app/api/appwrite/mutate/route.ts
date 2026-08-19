import { NextResponse } from "next/server";
import { appwriteRest } from "@/lib/appwrite/rest";
import { appwriteConfig } from "@/lib/appwrite/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, table, documentId, data, queries } = body;

    const dbId = appwriteConfig.databaseId;
    const collectionId = table;

    if (action === "insert") {
      const docId = documentId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const created = await appwriteRest.createDocument(dbId, collectionId, docId, data);
      return NextResponse.json({ data: { ...created, id: created.$id }, success: true });
    }

    if (action === "update") {
      if (!documentId) {
        return NextResponse.json({ error: "documentId é obrigatório para update" }, { status: 400 });
      }
      try {
        const updated = await appwriteRest.updateDocument(dbId, collectionId, documentId, data);
        return NextResponse.json({ data: { ...updated, id: updated.$id }, success: true });
      } catch (err: any) {
        const list = await appwriteRest.listDocuments(dbId, collectionId);
        const match = (list.documents || []).find((d: any) => d.$id === documentId || d.id === documentId);
        if (match) {
          const updated = await appwriteRest.updateDocument(dbId, collectionId, match.$id, data);
          return NextResponse.json({ data: { ...updated, id: updated.$id }, success: true });
        }
        throw err;
      }
    }

    if (action === "delete") {
      if (!documentId) {
        return NextResponse.json({ error: "documentId é obrigatório para delete" }, { status: 400 });
      }
      try {
        await appwriteRest.deleteDocument(dbId, collectionId, documentId);
        return NextResponse.json({ success: true });
      } catch (err: any) {
        try {
          const list = await appwriteRest.listDocuments(dbId, collectionId);
          const match = (list.documents || []).find((d: any) => d.$id === documentId || d.id === documentId);
          if (match) {
            await appwriteRest.deleteDocument(dbId, collectionId, match.$id);
            return NextResponse.json({ success: true });
          }
        } catch {}
        return NextResponse.json({ success: true, message: "Removido ou inexistente" });
      }
    }

    if (action === "list") {
      const list = await appwriteRest.listDocuments(dbId, collectionId, queries || []);
      return NextResponse.json({ data: list.documents || [], total: list.total || 0, success: true });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err: any) {
    console.error("[/api/appwrite/mutate] Error:", err.message);
    return NextResponse.json({ error: err.message || "Erro na mutação Appwrite" }, { status: 500 });
  }
}
