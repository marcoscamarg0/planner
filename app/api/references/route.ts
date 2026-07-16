import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFromUrl, extractFromPdfBuffer, clampText } from "@/lib/knowledge/extract";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ references: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      // PDF upload
      const form = await req.formData();
      const file = form.get("file");
      const providedTitle = (form.get("title") as string | null)?.trim();

      if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
        return NextResponse.json({ error: "Arquivo PDF ausente" }, { status: 400 });
      }
      const actualFile = file as File;
      if (actualFile.type !== "application/pdf" && !actualFile.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "Apenas arquivos PDF são aceitos" }, { status: 400 });
      }
      if (actualFile.size > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "PDF maior que 15MB" }, { status: 400 });
      }

      const arrayBuffer = await actualFile.arrayBuffer();
      const text = await extractFromPdfBuffer(Buffer.from(arrayBuffer));

      if (!text) {
        return NextResponse.json(
          { error: "Não foi possível extrair texto deste PDF (pode ser um PDF escaneado)" },
          { status: 422 }
        );
      }

      const { data, error } = await supabase
        .from("knowledge_sources")
        .insert({
          owner_id: user.id,
          type: "pdf",
          title: providedTitle || actualFile.name.replace(/\.pdf$/i, ""),
          source_url: null,
          content: text,
        })
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ reference: data }, { status: 201 });
    }

    // JSON body: link or text
    const body = await req.json();
    const { type, title, url, content } = body as {
      type: "link" | "text";
      title?: string;
      url?: string;
      content?: string;
    };

    if (type === "link") {
      if (!url) {
        return NextResponse.json({ error: "URL é obrigatória" }, { status: 400 });
      }
      const extracted = await extractFromUrl(url);
      if (!extracted.content) {
        return NextResponse.json(
          { error: "Não foi possível extrair conteúdo legível deste link" },
          { status: 422 }
        );
      }

      const { data, error } = await supabase
        .from("knowledge_sources")
        .insert({
          owner_id: user.id,
          type: "link",
          title: title?.trim() || extracted.title,
          source_url: url,
          content: extracted.content,
        })
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ reference: data }, { status: 201 });
    }

    if (type === "text") {
      if (!content || !content.trim()) {
        return NextResponse.json({ error: "Conteúdo do texto é obrigatório" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("knowledge_sources")
        .insert({
          owner_id: user.id,
          type: "text",
          title: title?.trim() || "Nota de texto",
          source_url: null,
          content: clampText(content.trim()),
        })
        .select("*")
        .single();

      if (error) throw error;
      return NextResponse.json({ reference: data }, { status: 201 });
    }

    return NextResponse.json({ error: "Tipo de referência inválido" }, { status: 400 });
  } catch (error: any) {
    console.error("References POST error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar referência" },
      { status: 500 }
    );
  }
}
