import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildChatPrompt } from "@/lib/openrouter/prompts";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    // Busca Contexto (RAG - Retrieval Augmented Generation)
    const [
      { data: projects },
      { data: tasks },
      { data: references }
    ] = await Promise.all([
      supabase.from("projects").select("id, title, status, description").eq("owner_id", user.id).neq("status", "archived").limit(10),
      supabase.from("tasks").select("title, status, priority, due_date, project_id").neq("status", "done").order("due_date", { ascending: true }).limit(20),
      supabase.from("knowledge_sources").select("id, type, title, source_url, content").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(12)
    ]);

    const contextData = {
      projects: projects ?? [],
      pending_tasks: tasks ?? [],
      // Referências anexadas pelo usuário (links, PDFs, textos) — conteúdo truncado por fonte
      reference_sources: (references ?? []).map((r) => ({
        title: r.title,
        type: r.type,
        source_url: r.source_url,
        excerpt: (r.content || "").slice(0, 2500),
      })),
    };

    const promptMessages = buildChatPrompt(messages, contextData);

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      throw new Error("Missing OPENROUTER_API_KEY");
    }

    // Vamos usar o modelo online se disponível ou o modelo padrao
    // O usuário precisa configurar na Vercel o OPENROUTER_MODEL_CHAT
    const model = process.env.OPENROUTER_MODEL_CHAT || "meta-llama/llama-3.1-8b-instruct";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Governo AI Planner",
      },
      body: JSON.stringify({
        model: model,
        messages: promptMessages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "Falha na IA" }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || "Sem resposta.";

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
