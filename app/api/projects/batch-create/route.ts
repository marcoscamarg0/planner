import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateProjectColor } from "@/lib/utils";

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
    const parentId = body.parentId ? String(body.parentId).trim() : null;
    const subprojectsData: Array<{
      title: string;
      description?: string;
      emoji?: string;
      color?: string;
      target_url?: string;
      category?: string;
    }> = Array.isArray(body.subprojects) ? body.subprojects : [];

    if (subprojectsData.length === 0) {
      return NextResponse.json({ error: "Nenhum subprojeto fornecido para criação." }, { status: 400 });
    }

    const db = await createServiceClient();

    const COLORS = [
      "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
      "#f97316", "#eab308", "#10b981", "#06b6d4", "#3b82f6"
    ];

    const recordsToInsert = subprojectsData.map((item, idx) => ({
      owner_id: user.id,
      parent_id: parentId && parentId !== "none" ? parentId : null,
      title: item.title.trim(),
      description: item.description?.trim() || null,
      emoji: item.emoji || "📋",
      color: item.color || COLORS[idx % COLORS.length],
      target_url: item.target_url?.trim() || null,
      status: "active",
    }));

    const { data: inserted, error: insertError } = await db
      .from("projects")
      .insert(recordsToInsert)
      .select();

    if (insertError) {
      console.error("[batch-create] Erro ao inserir subprojetos:", insertError);
      throw insertError;
    }

    const createdProjects = inserted || [];

    // Opcional: Cria a primeira página para cada subprojeto inserido
    if (createdProjects.length > 0) {
      const pagesToInsert = createdProjects.map((p) => ({
        project_id: p.id,
        title: "Visão Geral & Requisitos",
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: p.title }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: p.description || `Subprojeto importado automaticamente para o serviço: ${p.target_url || ""}`,
                },
              ],
            },
          ],
        },
        order_index: 0,
      }));

      await db.from("pages").insert(pagesToInsert);
    }

    return NextResponse.json({
      success: true,
      count: createdProjects.length,
      created: createdProjects,
    });
  } catch (err: any) {
    console.error("[batch-create] Erro:", err);
    return NextResponse.json({
      error: err.message || "Erro ao criar subprojetos em lote",
    }, { status: 500 });
  }
}
