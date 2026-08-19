import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODEL = "openrouter/free"; // Or any other good model for parsing
const FALLBACK_MODEL = "qwen/qwen-2.5-coder-32b-instruct:free";

async function callOpenRouter(messages: any[], apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://planner-j53e.onrender.com",
        "X-Title": "Planner QA Suite",
      },
      body: JSON.stringify({ 
        model: MODEL, 
        messages, 
        temperature: 0.1, // Low temp for data extraction
        max_tokens: 8000 
      }),
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Fallback
    console.warn("[QA API] First model failed, trying fallback...", error);
    const fallbackResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        model: FALLBACK_MODEL, 
        messages, 
        temperature: 0.1, 
        max_tokens: 8000 
      }),
    });

    if (!fallbackResponse.ok) {
      throw new Error(`OpenRouter fallback error: ${fallbackResponse.status}`);
    }

    const fallbackData = await fallbackResponse.json();
    return fallbackData.choices[0]?.message?.content || "";
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectIds } = await req.json();
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: "Nenhum projeto selecionado" }, { status: 400 });
    }

    // 1. Fetch projects
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, title, description")
      .in("id", projectIds);

    if (projectsError) throw projectsError;

    // 2. Fetch QA reports for these projects
    const { data: reports, error: reportsError } = await supabase
      .from("qa_reports")
      .select("project_id, title, type, result_raw")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (reportsError && !reportsError.message?.includes('project_id')) {
      console.warn("Erro ao buscar qa_reports:", reportsError);
      // Ignoramos o erro se a tabela não tiver os dados, ainda temos o flow_data dos projetos
    }

    // 3. Build data context for AI
    const projectSummaries = ((projects as any[]) || []).map((p: any, index: number) => {
      const pReports = ((reports as any[]) || []).filter((r: any) => r.project_id === p.id);
      let contextStr = `PROJETO ${index + 1}: ${p.title}\nID_INTERNO: ${p.id}\nDESCRIÇÃO: ${p.description || "N/A"}\n`;
      
      if (pReports.length > 0) {
        contextStr += `RESULTADOS DOS TESTES (QA):\n`;
        // Limit to top 3 reports to avoid context limit
        pReports.slice(0, 3).forEach((r: any, i: number) => {
          contextStr += `--- RELATÓRIO ${i+1} (${r.type} - ${r.title}) ---\n`;
          contextStr += `${(r.result_raw || "").substring(0, 1500)}\n`;
        });
      } else {
        contextStr += `Nenhum teste encontrado para este projeto.\n`;
      }
      return contextStr;
    }).join("\n====================================\n\n");

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

    // 4. Prompt
    const systemPrompt = `Você é um analista de qualidade (QA) especialista.
Sua tarefa é ler os dados e resultados de testes dos projetos e gerar uma tabela CSV completa.

Instruções RIGOROSAS:
1. Retorne APENAS a string do CSV válido. Sem crases (\`\`\`), sem explicações. APENAS o CSV.
2. O separador DEVE ser ponto e vírgula (;). Isso é crucial para abrir corretamente no Excel em português.
3. Todas as células (exceto o ID numérico) devem estar entre aspas duplas (""). Exemplo: 1;"Serviço A";"Sim"...
4. A PRIMEIRA LINHA do CSV DEVE ser obrigatoriamente a linha de cabeçalho com os nomes das colunas.
5. As colunas DEVEM INCLUIR TODAS AS SEGUINTES, de forma detalhada: 
   ID;Serviço;Eixo;Produto;Login Integrado;Avaliação do Serviço;Avalição da Página;Gratuito;PagTesouro;Contatos;Legislação
6. ALÉM DAS COLUNAS ACIMA, você deve CRIAR e PREENCHER colunas específicas e detalhadas para os testes de QA que encontrar nos relatórios, por exemplo:
   - Acessibilidade (Resuma falhas de contraste, navegação, leitores de tela)
   - Performance (Resuma lentidão, tempos de carregamento)
   - Links Quebrados (Indique quais links falharam)
   - Bugs Funcionais (Erros de interface ou lógica)
   - Melhorias Sugeridas
7. Para CADA PROJETO, você gerará EXATAMENTE UMA LINHA de dados.
8. Se uma informação administrativa (ex: PagTesouro, Eixo) não estiver no projeto, preencha "Não Informado", mas tente deduzir o máximo possível do texto fornecido. Para colunas de testes (ex: Acessibilidade) onde o projeto não teve esse teste, preencha "Não Testado".`;

    const userPrompt = `Gere a planilha em formato CSV com base nos seguintes dados de projetos e seus testes de QA:\n\n${projectSummaries}`;

    const csvResult = await callOpenRouter(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      apiKey
    );

    // Clean up response if AI included markdown blocks
    const cleanCsv = csvResult.replace(/```csv\n?/g, "").replace(/```\n?/g, "").trim();

    return new NextResponse(cleanCsv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
      }
    });
  } catch (error: any) {
    console.error("[POST /api/ai/spreadsheet]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
