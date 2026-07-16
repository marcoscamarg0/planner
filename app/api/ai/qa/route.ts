import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const AVAILABLE_MODELS: Record<string, string> = {
  "deepseek-v3": "deepseek/deepseek-chat-v3-0324:free",
  "llama-3.1-8b": "meta-llama/llama-3.1-8b-instruct:free",
  "mistral-7b": "mistralai/mistral-7b-instruct:free",
  "gemma-3-27b": "google/gemma-3-27b-it:free",
  "qwen-3-8b": "qwen/qwen3-8b:free",
};

async function callOpenRouter(
  messages: { role: string; content: string }[],
  modelKey: string,
  apiKey: string
) {
  const model = AVAILABLE_MODELS[modelKey] || AVAILABLE_MODELS["deepseek-v3"];
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Planner QA Suite",
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error("OpenRouter error: " + err);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tool_type, input, framework, model } = await req.json();
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

    let result = "";

    if (tool_type === "test_cases") {
      const sys = "Você é um engenheiro de QA sênior especialista em criação de casos de teste. "
        + "Sua missão é gerar casos de teste completos, estruturados e profissionais. "
        + "Retorne EXATAMENTE um JSON válido com o formato: "
        + '{"test_cases": [{"id": "TC001", "title": "...", "category": "happy_path|error|edge_case", "steps": ["passo 1", "passo 2"], "expected_result": "...", "priority": "alta|media|baixa"}]}';

      const usr = "Gere casos de teste completos para a seguinte funcionalidade:\n\n" + input
        + "\n\nCobre cenarios de: Happy Path, Erros esperados e Casos de borda. Retorne apenas o JSON.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model || "llama-3.1-8b",
        apiKey
      );

    } else if (tool_type === "test_report") {
      const sys = "Voce e um lider de qualidade especialista em documentacao de testes de software. "
        + "Escreva relatorios de teste formais, claros e detalhados em Markdown.";

      const usr = "Crie um relatorio de teste de software completo com base nos seguintes dados:\n\n"
        + input
        + "\n\nO relatorio deve conter: 1) Objetivo, 2) Escopo, 3) Ambiente de Testes, "
        + "4) Resumo dos Resultados (tabela), 5) Bugs e Defeitos encontrados, 6) Conclusao e Recomendacoes.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model || "llama-3.1-8b",
        apiKey
      );

    } else if (tool_type === "automation") {
      const fw = framework || "playwright";
      const langMap: Record<string, string> = {
        cypress: "JavaScript/TypeScript com Cypress",
        playwright: "TypeScript com Playwright",
        selenium: "Python com Selenium WebDriver",
      };
      const lang = langMap[fw] || langMap["playwright"];

      const sys = "Voce e um engenheiro de automacao de testes sênior. "
        + "Gere scripts de teste automatizado profissionais, bem comentados e prontos para uso. "
        + "Retorne APENAS o codigo, sem explicacoes extras fora do codigo.";

      const usr = "Crie um script de automacao de testes completo usando " + lang + " para:\n\n"
        + input
        + "\n\nInclua: imports, configuracao, descricao dos blocos de teste (describe/it ou equivalente), "
        + "selecao de elementos por atributos acessiveis, assercoes claras e tratamento de erros basico.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model || "mistral-7b",
        apiKey
      );

    } else {
      return NextResponse.json({ error: "Invalid tool_type" }, { status: 400 });
    }

    return NextResponse.json({ result });

  } catch (error: any) {
    console.error("QA API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
