import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      throw new Error("Missing OPENROUTER_API_KEY");
    }

    const model = process.env.OPENROUTER_MODEL_CHAT || "openrouter/free";

    // Pega contexto opcional se tiver referências
    const { data: references } = await supabase
      .from("knowledge_sources")
      .select("title, type, content")
      .eq("owner_id", user.id)
      .limit(10);
    
    const contextText = references && references.length > 0 
      ? "\n\n--- SUAS REFERÊNCIAS DE CONTEXTO ---\n" + 
        references.map(r => `[${r.type}] ${r.title}\n${(r.content || "").slice(0, 1000)}`).join("\n\n") + 
        "\n----------------------------------"
      : "";

    const sysPrompt = 
      "Você é um especialista em criar diagramas, mapas mentais e organogramas usando a sintaxe Mermaid.js. " +
      "Seu objetivo é gerar um diagrama estruturado que atenda à solicitação do usuário. " +
      "Use as referências do usuário (se fornecidas) para embasar seu gráfico caso seja relacionado. " +
      "REGRAS: " +
      "1. Retorne APENAS o código do Mermaid, envolto em um bloco ```mermaid ... ```. " +
      "2. NÃO adicione nenhum outro texto, introdução ou explicação. " +
      "3. Prefira gráficos do tipo 'graph TD' (para organogramas/fluxogramas) ou 'mindmap' (para mapas mentais). " +
      "4. Faça algo legível, usando cores ou estilos (classDef) se achar apropriado, mas mantenha o código válido.";

    const userPrompt = `Crie um diagrama para o seguinte tema/solicitação: ${prompt}${contextText}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + openRouterApiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Planner Mermaid Gen",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "Falha ao gerar diagrama" }, { status: 500 });
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content || "";

    return NextResponse.json({ chart: result });

  } catch (error: any) {
    console.error("Organogram Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
