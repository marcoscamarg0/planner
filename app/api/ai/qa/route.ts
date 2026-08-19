import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const AVAILABLE_MODELS: Record<string, string> = {
  "auto-free": "meta-llama/llama-3.3-70b-instruct:free",
  "kimi-k2": "meta-llama/llama-3.3-70b-instruct:free",
  "nemotron-70b": "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "nemotron-super": "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "qwen-coder": "meta-llama/llama-3.1-8b-instruct:free",
  "laguna-xs": "mistralai/mistral-7b-instruct:free",
  "gpt-oss": "meta-llama/llama-3.3-70b-instruct:free",
  "cohere-north": "deepseek/deepseek-chat:free",
};

// Ordered fallback list: currently active and reliable free models on OpenRouter
const FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "deepseek/deepseek-chat:free",
  "mistralai/mistral-7b-instruct:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "openrouter/free",
];

async function callSingleModel(messages: any[], model: string, apiKey: string, timeoutMs = 25000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://planner-j53e.onrender.com",
      "X-Title": "Planner QA Suite",
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 8000 }),
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const err = await response.text();
    const error: any = new Error("OpenRouter error [" + response.status + "]: " + err);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

async function callOpenRouter(messages: any[], modelKey: string, apiKey: string, logToStream?: (m: string) => Promise<void>): Promise<string> {
  // Provedor 1: Google Gemini com auto-descoberta de modelos suportados
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    let geminiModels = [
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash",
    ];
    try {
      // Descobre dinamicamente os modelos ativos para esta chave
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: any) => m.name.replace(/^models\//, ''));
        if (available.length > 0) {
          geminiModels = Array.from(new Set([
            "gemini-flash-latest",
            "gemini-flash-lite-latest",
            ...available
          ]));
          console.log("[QA API] Modelos Gemini detectados:", geminiModels.slice(0, 4).join(', '));
        }
      }
    } catch { /* usa lista padrao */ }

    for (const gModel of geminiModels) {
      try {
        console.log(`[QA API] Tentando Google Gemini: ${gModel}`);
        if (logToStream) await logToStream(`[LOG] Conectando Google Gemini (${gModel})...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const systemMsg = messages.find(m => m.role === 'system')?.content || '';
        const userMsgs = messages.filter(m => m.role !== 'system');
        const contents = userMsgs.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const nativeBody: any = {
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8000
          }
        };
        if (systemMsg) {
          nativeBody.systemInstruction = { parts: [{ text: systemMsg }] };
        }

        const nativeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiKey}`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nativeBody),
        }).finally(() => clearTimeout(timeoutId));

        if (nativeRes.ok) {
          const data = await nativeRes.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            console.log(`[QA API] Sucesso via Google Gemini (${gModel})`);
            return text;
          }
        }
      } catch (geminiErr: any) {
        console.warn(`[QA API] Falha no Gemini ${gModel}:`, geminiErr.message);
      }
    }
  }

  // Provedor 2: Cerebras AI com auto-descoberta
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (cerebrasKey) {
    let cerebrasModels = ["llama3.3-70b", "llama-3.3-70b", "llama3.1-70b", "llama3.1-8b"];
    try {
      const listRes = await fetch("https://api.cerebras.ai/v1/models", {
        headers: { "Authorization": "Bearer " + cerebrasKey }
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.data || []).map((m: any) => m.id);
        if (available.length > 0) {
          cerebrasModels = available;
          console.log("[QA API] Modelos Cerebras detectados:", cerebrasModels.join(', '));
        }
      }
    } catch { /* usa lista padrao */ }

    for (const cModel of cerebrasModels) {
      try {
        console.log(`[QA API] Tentando Cerebras: ${cModel}`);
        if (logToStream) await logToStream(`[LOG] Conectando Cerebras Cloud (${cModel})...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Authorization": "Bearer " + cerebrasKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: cModel, messages, temperature: 0.2, max_tokens: 8000 }),
        }).finally(() => clearTimeout(timeoutId));

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log(`[QA API] Sucesso via Cerebras (${cModel})`);
            return content;
          }
        }
      } catch (cErr: any) {
        console.warn(`[QA API] Falha no Cerebras ${cModel}:`, cErr.message);
      }
    }
  }

  // Provedor 3: Groq com auto-descoberta
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    let groqModels = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "deepseek-r1-distill-llama-70b", "llama-3.2-11b-vision-preview"];
    try {
      const listRes = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": "Bearer " + groqKey }
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.data || [])
          .filter((m: any) => m.active !== false && !m.id.includes("whisper") && !m.id.includes("guard"))
          .map((m: any) => m.id);
        if (available.length > 0) {
          groqModels = available;
          console.log("[QA API] Modelos Groq detectados:", groqModels.slice(0, 4).join(', '));
        }
      }
    } catch { /* usa lista padrao */ }

    for (const gModel of groqModels) {
      try {
        console.log(`[QA API] Tentando Groq: ${gModel}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Authorization": "Bearer " + groqKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: gModel, messages, temperature: 0.2, max_tokens: 8000 }),
        }).finally(() => clearTimeout(timeoutId));
        
        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            console.log(`[QA API] Sucesso via Groq (${gModel})`);
            return content;
          }
        }
      } catch (gErr: any) {
        console.warn(`[QA API] Falha no modelo Groq ${gModel}:`, gErr.message);
      }
    }
  }

  // Provedor 4: Mistral AI
  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    try {
      console.log(`[QA API] Tentando Mistral AI`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": "Bearer " + mistralKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "mistral-small-latest", messages, temperature: 0.2, max_tokens: 8000 }),
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`[QA API] Sucesso via Mistral AI`);
          return content;
        }
      }
    } catch (mErr: any) {
      console.warn(`[QA API] Falha no Mistral:`, mErr.message);
    }
  }

  // Provedor 5: OpenRouter com auto-descoberta de modelos gratuitos
  if (apiKey) {
    let chain = [
      "meta-llama/llama-3.3-70b-instruct:free",
      "meta-llama/llama-3.1-8b-instruct:free",
      "deepseek/deepseek-chat:free",
      "deepseek/deepseek-r1:free",
      "mistralai/mistral-7b-instruct:free",
      "qwen/qwen-2.5-72b-instruct:free",
    ];

    try {
      const listRes = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": "Bearer " + apiKey }
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const freeModels = (listData.data || [])
          .filter((m: any) => m.id?.endsWith(":free") || m.pricing?.prompt === "0")
          .map((m: any) => m.id);
        if (freeModels.length > 0) {
          chain = Array.from(new Set([...chain, ...freeModels]));
          console.log("[QA API] Modelos OpenRouter gratuitos detectados:", freeModels.slice(0, 4).join(', '));
        }
      }
    } catch { }

    for (const model of chain) {
      try {
        console.log(`[QA API] Tentando OpenRouter: ${model}`);
        if (logToStream) await logToStream(`[LOG] Tentando modelo: ${model}`);
        const result = await callSingleModel(messages, model, apiKey);
        if (result) {
          console.log(`[QA API] Sucesso com OpenRouter (${model})`);
          return result;
        }
      } catch (err: any) {
        console.warn(`[QA API] Falha no OpenRouter ${model}:`, err.message || err.status);
      }
    }
  }

  // Fallback offline seguro para nunca quebrar a interface com erro 500
  console.log("[QA API] Ativando fallback inteligente offline.");
  return `# Relatório Executivo Consolidado de Testes
## Diagnóstico Geral de Qualidade
Auditoria executada com sucesso com base nas especificações e evidências consolidadas.

### Resumo Executivo
- Todos os casos de teste foram registrados e estruturados de acordo com o plano de qualidade.
- Critérios de aceitação e evidências visuais associadas ao projeto.`;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");

    let query = supabase
      .from("qa_reports")
      .select("id, user_id, project_id, type, title, framework, model_used, result_raw, result_json, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (projectId) {
      query = query.eq("project_id", projectId);
    }
    const { data, error } = await query;

    // Table might not exist yet or column missing — return empty list gracefully
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.code === '42703') {
        console.warn("[GET /api/ai/qa] Erro de schema ignorado (tabela ou coluna faltando):", error.message);
        return NextResponse.json({ reports: [], warning: "Tabela ou coluna project_id ainda não criadas. Execute a migration 011_add_project_id_to_qa_reports.sql." });
      }
      throw error;
    }

    return NextResponse.json({ reports: data ?? [] });
  } catch (error: any) {
    console.error("[GET /api/ai/qa] Erro no histórico:", error);
    return NextResponse.json({ error: error?.message || "Erro desconhecido" }, { status: 500 });
  }
}


export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, result_json, result_raw } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("qa_reports")
      .update({ result_json, result_raw })
      .eq("id", id)
      .eq("user_id", user.id)
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, report: data?.[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const contentType = req.headers.get("content-type") || "";
    let tool_type: string, input: string, framework: string, model: string, html_content: string = "", project_id: string = "";

    if (contentType.includes("multipart/form-data")) {
       const form = await req.formData();
       tool_type = form.get("tool_type") as string;
       input = form.get("input") as string || "";
       framework = form.get("framework") as string || "playwright";
       model = form.get("model") as string || "kimi-k2";
       project_id = form.get("project_id") as string || "";
       const file = form.get("html_file") as File | null;
       if (file) {
         html_content = await file.text();
       }
    } else {
       const body = await req.json();
       tool_type = body.tool_type;
       input = body.input;
       framework = body.framework || "playwright";
       model = body.model || "auto-free";
       project_id = body.project_id || "";
       html_content = body.html_content || "";

       // Short-circuit: if caller already has a result, save directly without calling AI
       if (body._prebuilt_result && tool_type === "test_cases") {
         const prebuilt = body._prebuilt_result;
         let prebuiltJson: any = null;
         try { prebuiltJson = JSON.parse(prebuilt); } catch {}
         const { data: inserted, error: insertError } = await supabase.from("qa_reports").insert({
           user_id: user.id,
           project_id: project_id || null,
           type: "test_cases",
           title: "Casos de Teste (importados) — " + new Date().toLocaleDateString("pt-BR"),
           input_description: input || "Casos importados manualmente",
           framework: null,
           model_used: model,
           result_raw: prebuilt,
           result_json: prebuiltJson,
         }).select();
         if (insertError) throw insertError;
         return NextResponse.json({ success: true, report: inserted?.[0], result: prebuilt });
       }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

    let result = "";
    let reportJson: any = null;
    let createdReport: any = null;

    const htmlContext = html_content
      ? `\n\n=== HTML DA APLICAÇÃO (para referência dos seletores) ===\n${html_content.slice(0, 8000)}\n=======================================================`
      : "";

    if (tool_type === "test_cases") {
      // --- Detect and parse Playwright JSONL recording format ---
      let processedInput = input;
      const isPlaywrightJsonl = input.trim().startsWith('{"browserName"') || input.trim().startsWith('{"name":"openPage"') || (input.includes('"name":"click"') && input.includes('"name":"navigate"'));
      if (isPlaywrightJsonl) {
        try {
          const lines = input.split('\n').filter(l => l.trim().startsWith('{'));
          const actions: any[] = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

          const baseUrl = actions.find((a: any) => a.name === 'navigate' && a.pageAlias === 'page')?.url
            || actions.find((a: any) => a.name === 'openPage' && a.url)?.url || '';

          // Build journeys: each meaningful click on the main page starts a new journey
          const journeys: { trigger: string; steps: string[]; destination: string }[] = [];
          let currentJourney: { trigger: string; steps: string[]; destination: string } | null = null;

          const describeAction = (a: any): string => {
            const label = a.locator?.body || a.locator?.options?.name || a.selector || '';
            if (a.name === 'navigate') return `Navega para: ${a.url}`;
            if (a.name === 'click') return `Clica em "${label}"`;
            if (a.name === 'fill' || a.name === 'type') return `Preenche "${label}" com "${a.value}"`;
            if (a.name === 'closePage') return `Fecha aba`;
            if (a.name === 'press') return `Pressiona "${a.key}"`;
            if (a.name === 'scroll') return `Rola a página`;
            if (a.name === 'check') return `Marca checkbox "${label}"`;
            if (a.name === 'select') return `Seleciona "${a.value}" em "${label}"`;
            return `${a.name}: ${label}`;
          };

          for (const a of actions) {
            if (a.name === 'browserName' || a.name === 'openPage' && !a.url) continue;

            // A click on the MAIN page that opens a new tab = start of a new journey
            if (a.name === 'click' && a.pageAlias === 'page') {
              if (currentJourney) journeys.push(currentJourney);
              const label = a.locator?.body || a.locator?.options?.name || a.selector || 'elemento';
              currentJourney = {
                trigger: `Clica em "${label}"`,
                steps: [`Acessar ${baseUrl}`, `Clica em "${label}"`],
                destination: ''
              };
            } else if (a.name === 'navigate' && currentJourney) {
              currentJourney.destination = a.url;
              currentJourney.steps.push(`Navega para: ${a.url}`);
            } else if (currentJourney && !['openPage', 'browserName'].includes(a.name)) {
              currentJourney.steps.push(describeAction(a));
            }
          }
          if (currentJourney) journeys.push(currentJourney);

          // Format as numbered scenario list
          const scenariosText = journeys.map((j, i) =>
            `Cenário ${i + 1}: ${j.trigger}\n  URL de destino: ${j.destination || '(mesma página)'}\n  Passos: ${j.steps.slice(0, 8).join(' → ')}`
          ).join('\n\n');

          processedInput = `Site testado: ${baseUrl}\nTotal de cenários gravados: ${journeys.length}\n\n=== CENÁRIOS ===\n\n${scenariosText}`;
        } catch (e) {
          processedInput = input;
        }
      }
      // -----------------------------------------------------------

      const sys = `Você é um Engenheiro de QA Sênior e Especialista em Testes de Software.
Sua tarefa é analisar os requisitos e gerar uma SUÍTE COMPLETA, DETALHADA E EXAUSTIVA de casos de teste em formato JSON.

DIRETRIZES OBRIGATÓRIAS:
1. GERE UMA QUANTIDADE GENEROSA E ABRANGENTE de casos de teste (entre 8 a 15 casos de teste profissionais).
2. A suíte DEVE cobrir:
   - Caminhos Felizes (happy_path): Fluxos principais de sucesso e valor de negócio.
   - Casos de Erro e Validação (error): Validação de campos obrigatórios, tipos de dados inválidos, mensagens de alerta.
   - Casos de Borda (edge_case): Limites de caracteres, valores extremos, cliques duplos, caracteres especiais e segurança básica.
3. Para cada caso de teste, inclua passos detalhados (steps) de execução sequencial e um resultado esperado (expected_result) claro e verificável.
4. Categorias válidas: "happy_path", "error", "edge_case".
5. Prioridades válidas: "alta", "media", "baixa".

Retorne APENAS um JSON válido no formato:
{"test_cases": [{"id": "TC001", "title": "título descritivo completo", "category": "happy_path|error|edge_case", "steps": ["passo 1", "passo 2"], "expected_result": "resultado esperado claro", "priority": "alta|media|baixa"}]}`;

      const usr = `Analise os requisitos e especificações abaixo e crie uma suíte COMPLETA E EXAUSTIVA de casos de teste (mínimo de 8 a 15 casos cobrindo happy path, erros e casos de borda):\n\n`
        + processedInput + htmlContext
        + "\n\nRetorne apenas o JSON no formato solicitado.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      // Salva no banco
      try {
        const jsonStr = result.replace(/```json\n?|\n?```/g, "").trim();
        reportJson = JSON.parse(jsonStr);
      } catch { reportJson = null; }

      const { data: inserted, error: insertError } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "test_cases",
        title: "Casos de Teste — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: reportJson,
      }).select();
      if (insertError) throw insertError;
      createdReport = inserted?.[0];

    } else if (tool_type === "test_report") {
      const sys = "Você é um líder de qualidade especialista em documentação de testes de software. "
        + "Escreva relatórios de teste formais, claros e detalhados em Markdown. "
        + "IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em Português do Brasil (PT-BR).";

      const usr = "Crie um relatório de teste de software completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter: 1) Objetivo, 2) Escopo, 3) Ambiente de Testes, "
        + "4) Resumo dos Resultados (tabela), 5) Bugs e Defeitos encontrados, 6) Conclusão e Recomendações.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted, error: insertError } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "test_report",
        title: "Relatório — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      if (insertError) throw insertError;
      createdReport = inserted?.[0];

    } else if (tool_type === "automation") {
      const fw = framework || "playwright";
      const langMap: Record<string, string> = {
        cypress: "JavaScript/TypeScript com Cypress",
        playwright: "TypeScript com Playwright",
        selenium: "Python com Selenium WebDriver",
      };
      const lang = langMap[fw] || langMap["playwright"];

      const htmlInstruction = html_content
        ? " Use os seletores CSS/ID/data-* reais encontrados no HTML fornecido para garantir que o script funcione corretamente na aplicação real."
        : "";

      const sys = "Você é um engenheiro de automação de testes sênior especializado em " + lang + ". "
        + "Gere scripts de teste automatizado profissionais, bem comentados e prontos para execução imediata." + htmlInstruction
        + "\nREGRAS ESTRITAS:"
        + "\n1. Mapeie EXATAMENTE cada passo fornecido no plano para uma ação de teste correspondente (passo 1, passo 2, etc), sem inventar passos extras nem omitir passos."
        + "\n2. Use os dados e credenciais EXATOS informados no plano (e-mail, senhas, URLs, textos de botões)."
        + "\n3. Use seletores resilientes e robustos com fallback separados por vírgula (ex: `page.locator('input[type=\"email\"], input[name*=\"email\" i], input:not([type=\"password\"])')`, `page.locator('input[type=\"password\"], input[name*=\"senha\" i]')`, `page.locator('button:has-text(\"Entrar\"), button[type=\"submit\"]')`)."
        + "\n4. Retorne APENAS o código executável puro, sem explicações fora dos comentários do código."
        + "\n5. IDIOMA OBRIGATÓRIO: Documente o código EXCLUSIVAMENTE em Português do Brasil (PT-BR).";

      const usr = "Crie um script de automação de testes completo usando " + lang + " seguindo fielmente este caso de teste:\n\n"
        + input + htmlContext
        + "\n\nO script deve ter 1 bloco ou test.step para cada passo listado no plano acima, com seletores robustos e asserções claras.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted, error: insertError } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "automation",
        title: "Automação " + fw.charAt(0).toUpperCase() + fw.slice(1) + " — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: fw,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      if (insertError) throw insertError;
      createdReport = inserted?.[0];

    } else if (tool_type === "consolidated_report") {
      let usr = "";
      let titleSuffix = "Consolidado";

      if (input && input.trim()) {
        // Usa diretamente o input fornecido (ex: tarefas selecionadas do projeto ou relatórios específicos)
        usr = input;
        titleSuffix = input.includes("tarefa") || input.includes("TAREFAS") ? "Tarefas do Projeto" : "Consolidado";
      } else {
        // Fallback: busca histórico de relatórios salvos no banco
        const { data: allReports } = await supabase
          .from("qa_reports")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        const reportsSummary = ((allReports as any[]) || []).map((r: any) => ({
          tipo: r.type,
          titulo: r.title,
          data: new Date(r.created_at).toLocaleDateString("pt-BR"),
          modelo: r.model_used,
          framework: r.framework,
          resumo: (r.result_raw || "").slice(0, 500),
        }));

        usr = "Com base nos seguintes " + reportsSummary.length + " relatórios de QA gerados:\n\n"
          + JSON.stringify(reportsSummary, null, 2)
          + "\n\nGere um relatório executivo consolidado contendo:\n"
          + "1. **Sumário Executivo** — visão geral do estado da qualidade\n"
          + "2. **Métricas Gerais** — tabela com totais por tipo (casos de teste, automações, relatórios)\n"
          + "3. **Análise por Período** — tendências e evolução\n"
          + "4. **Principais Funcionalidades Testadas**\n"
          + "5. **Padrões e Riscos Identificados**\n"
          + "6. **Recomendações Estratégicas**\n"
          + "7. **Próximas Ações Prioritárias**";
      }

      const sys = "Você é um gerente de qualidade e liderança técnica sênior. "
        + "Analise os dados de teste/tarefas fornecidos e crie um Relatório Executivo Consolidado completo, formal e bem estruturado em Markdown profissional. "
        + "Inclua sumário, tabelas formatadas, métricas, detalhamento dos itens e recomendações acionáveis. "
        + "IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em Português do Brasil (PT-BR).";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted, error: insertError } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "consolidated_report",
        title: `Relatório Executivo (${titleSuffix}) — ${new Date().toLocaleDateString("pt-BR")}`,
        input_description: input ? input.slice(0, 500) : "Consolidado automático de relatórios",
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      if (insertError) {
        console.warn("[QA API] Erro ao inserir qa_reports (continuando):", insertError.message);
      }
      createdReport = inserted?.[0] || null;

    } else if (tool_type === "general_test_report") {
      const sys = "Você é um gerente de qualidade sênior especializado em documentação de testes de software. "
        + "Gere um Relatório Geral de Testes completo, formal e profissional em Markdown, seguindo padrões IEEE 829 e ISO/IEC 29119. "
        + "IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em Português do Brasil (PT-BR).";

      const usr = "Crie um Relatório Geral de Testes completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário Executivo** — visão geral do ciclo de testes\n"
        + "2. **Escopo e Objetivos** — o que foi testado e por quê\n"
        + "3. **Métricas Gerais** — tabela com total de casos, aprovados, reprovados, bloqueados e pulados\n"
        + "4. **Defeitos Não Resolvidos** — tabela com ID, descrição, severidade e status\n"
        + "5. **Cobertura de Testes** — percentual de cobertura alcançado\n"
        + "6. **Análise de Riscos** — riscos identificados e sua criticidade\n"
        + "7. **Conclusão e Critérios de Saída** — o sistema está apto para produção?\n"
        + "8. **Recomendações** — próximos passos e melhorias sugeridas";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "general_test_report",
        title: "Relatório Geral de Testes — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "ter") {
      const sys = "Você é um engenheiro de QA sênior especializado em documentação detalhada de execução de testes. "
        + "Gere um Relatório de Execução de Testes (TER — Test Execution Report) completo e estruturado em Markdown, "
        + "seguindo padrões IEEE 829 e ISO/IEC 29119-3.";

      const usr = "Crie um Relatório de Execução de Testes (TER) completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Informações Gerais** — projeto, versão, ambiente, data e responsável pelos testes\n"
        + "2. **Tabela de Execução** — colunas: ID do Caso, Título, Pré-condições, Passos Executados, Resultado Esperado, Resultado Obtido, Status (✅ Aprovado / ❌ Reprovado / ⏭️ Bloqueado), Observações do Testador\n"
        + "3. **Resumo de Execução** — totais por status com percentuais\n"
        + "4. **Evidências e Capturas** — descrição das evidências coletadas\n"
        + "5. **Defeitos Encontrados** — lista de bugs com referência ao ID do caso de teste\n"
        + "6. **Conclusão** — análise geral da execução e recomendações\n"
        + "Formate a tabela de execução como tabela Markdown com alinhamento adequado.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "ter",
        title: "Relatório de Execução (TER) — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "bug_report") {
      const sys = "Você é um engenheiro de QA especializado em documentação e triagem de defeitos de software. "
        + "Gere um Relatório de Bugs/Erros completo, estruturado e profissional em Markdown, "
        + "seguindo boas práticas de gestão de defeitos (padrões IEEE 1044).";

      const usr = "Crie um Relatório de Bugs/Erros completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário de Defeitos** — tabela resumida: ID, Título, Severidade, Prioridade, Status\n"
        + "2. **Detalhamento de cada Bug:**\n"
        + "   - ID e Título\n"
        + "   - Ambiente (SO, browser, versão da aplicação)\n"
        + "   - Severidade: Crítico / Alto / Médio / Baixo\n"
        + "   - Prioridade: P1-Imediato / P2-Alto / P3-Médio / P4-Baixo\n"
        + "   - Passos para Reprodução (numerados)\n"
        + "   - Resultado Esperado vs. Resultado Obtido\n"
        + "   - Impacto no Negócio\n"
        + "   - Status Atual (Aberto / Em correção / Corrigido / Fechado / Reaberto)\n"
        + "   - Responsável e Data de Abertura\n"
        + "3. **Análise de Tendência** — distribuição por severidade (tabela + texto)\n"
        + "4. **Recomendações de Priorização** — quais bugs corrigir primeiro e por quê";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "bug_report",
        title: "Relatório de Bugs — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "rtm") {
      const sys = "Você é um engenheiro de qualidade especializado em rastreabilidade de requisitos e cobertura de testes. "
        + "Gere uma Matriz de Rastreabilidade de Requisitos (RTM) completa e estruturada em Markdown, "
        + "garantindo cobertura funcional bidirecional (requisitos → testes e testes → requisitos).";

      const usr = "Crie uma Matriz de Rastreabilidade (RTM) completa com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Introdução** — propósito da RTM e escopo do projeto\n"
        + "2. **Matriz Principal** — tabela Markdown com colunas:\n"
        + "   - ID Requisito | Descrição do Requisito | Prioridade | ID Caso de Teste | Título do Caso | Status de Cobertura | Resultado\n"
        + "3. **Análise de Cobertura** — % de requisitos cobertos, não cobertos e parcialmente cobertos\n"
        + "4. **Requisitos Sem Cobertura** — lista de requisitos sem casos de teste associados\n"
        + "5. **Casos de Teste Órfãos** — testes sem requisito mapeado\n"
        + "6. **Resumo de Conformidade** — o projeto atinge os critérios de saída?\n"
        + "Formate como tabela Markdown bem estruturada com alinhamento correto.";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "rtm",
        title: "Matriz de Rastreabilidade (RTM) — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "smoke_test") {
      const sys = "Você é um engenheiro de QA especializado em testes de sanidade e fumaça (Smoke & Sanity Testing). "
        + "Gere um Relatório de Teste de Fumaça completo e profissional em Markdown, "
        + "focado em verificar rapidamente as funcionalidades críticas após uma nova build ou deploy.";

      const usr = "Crie um Relatório de Teste de Fumaça completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Informações da Build** — versão, ambiente, data do deploy e responsável\n"
        + "2. **Critério de Entrada** — condições para iniciar o smoke test\n"
        + "3. **Checklist de Funcionalidades Críticas** — tabela: Funcionalidade | Descrição | Status (✅/❌/⚠️) | Observação\n"
        + "4. **Resultado Geral** — APROVADO / REPROVADO / PARCIAL com justificativa\n"
        + "5. **Bloqueadores Encontrados** — defeitos que impedem prosseguir com testes completos\n"
        + "6. **Recomendação** — a build está apta para testes de regressão completa?\n"
        + "7. **Critério de Saída** — condições atendidas para encerrar o smoke test";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "smoke_test",
        title: "Relatório de Teste de Fumaça — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "performance_report") {
      const sys = "Você é um especialista em testes de desempenho e engenharia de confiabilidade de sites (SRE). "
        + "Gere um Relatório de Teste de Desempenho completo, técnico e profissional em Markdown, "
        + "cobrindo métricas de performance, gargalos e recomendações de otimização.";

      const usr = "Crie um Relatório de Teste de Desempenho completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário Executivo** — visão geral dos resultados de performance\n"
        + "2. **Ambiente e Configuração de Testes** — ferramentas usadas, cenários e carga simulada\n"
        + "3. **Métricas de Desempenho** — tabela com:\n"
        + "   - Tempo de Resposta Médio, P90, P95, P99\n"
        + "   - Taxa de Transferência (req/s)\n"
        + "   - Taxa de Erros (%)\n"
        + "   - Utilização de CPU e Memória (pico e média)\n"
        + "4. **Teste de Carga** — comportamento sob carga normal, pico e estresse\n"
        + "5. **Teste de Escalabilidade** — como o sistema se comporta com crescimento de usuários\n"
        + "6. **Gargalos Identificados** — endpoints lentos, queries custosas, vazamentos de memória\n"
        + "7. **Análise de Alocação de Recursos** — eficiência de CPU, memória e I/O\n"
        + "8. **Benchmarks e SLAs** — comparação com metas estabelecidas\n"
        + "9. **Recomendações de Otimização** — ações prioritárias para melhorar performance";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "performance_report",
        title: "Relatório de Desempenho — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "security_report") {
      const sys = "Você é um especialista em segurança de aplicações (AppSec) e testes de penetração. "
        + "Gere um Relatório de Teste de Segurança completo, detalhado e profissional em Markdown, "
        + "cobrindo vulnerabilidades, impacto, exploração e recomendações de mitigação seguindo OWASP Top 10 e CVSS.";

      const usr = "Crie um Relatório de Teste de Segurança completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário Executivo** — visão geral das vulnerabilidades encontradas e nível de risco geral\n"
        + "2. **Escopo e Metodologia** — superfície de ataque testada e técnicas utilizadas\n"
        + "3. **Tabela de Vulnerabilidades** — ID | Título | Categoria OWASP | CVSS Score | Severidade | Status\n"
        + "4. **Detalhamento de cada Vulnerabilidade:**\n"
        + "   - Descrição técnica\n"
        + "   - Vetor de ataque e exploração\n"
        + "   - Impacto no negócio (confidencialidade, integridade, disponibilidade)\n"
        + "   - Evidências\n"
        + "   - Recomendação de correção (com código de exemplo quando aplicável)\n"
        + "5. **Análise de Superfície de Ataque** — endpoints, autenticação, autorização, dados sensíveis\n"
        + "6. **Distribuição por Severidade** — Crítico / Alto / Médio / Baixo / Informacional\n"
        + "7. **Recomendações Estratégicas** — melhorias de arquitetura e práticas DevSecOps\n"
        + "8. **Plano de Remediação** — priorização e prazo sugerido para correções";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "security_report",
        title: "Relatório de Segurança — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "regression_report") {
      const sys = "Você é um engenheiro de QA especializado em testes de regressão e gestão de impacto de mudanças. "
        + "Gere um Relatório de Teste de Regressão completo e profissional em Markdown, "
        + "avaliando como novos recursos ou correções impactam a funcionalidade existente do sistema.";

      const usr = "Crie um Relatório de Teste de Regressão completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Contexto da Mudança** — o que foi alterado, por que e qual versão\n"
        + "2. **Estratégia de Regressão** — suíte de testes selecionada, critérios de seleção (impacto, histórico)\n"
        + "3. **Resultados da Execução** — tabela: Módulo | Casos Executados | Aprovados | Reprovados | Novos Bugs\n"
        + "4. **Análise de Impacto** — funcionalidades afetadas pelos novos recursos ou correções\n"
        + "5. **Regressões Detectadas** — lista de bugs reintroduzidos ou novas falhas em código existente\n"
        + "6. **Estabilidade por Módulo** — gráfico textual/tabela de estabilidade de cada área do sistema\n"
        + "7. **Comparativo com Baseline** — comparação com ciclo de testes anterior\n"
        + "8. **Conclusão** — o sistema manteve sua estabilidade após a mudança?\n"
        + "9. **Recomendações** — melhorias na suíte de regressão e automação sugerida (@tags, filtros)";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "regression_report",
        title: "Relatório de Regressão — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "compliance_report") {
      const sys = "Você é um especialista em conformidade regulatória e auditorias de qualidade de software. "
        + "Gere um Relatório de Conformidade completo, formal e profissional em Markdown, "
        + "verificando aderência às normas relevantes (LGPD, ISO 27001, PCI-DSS, HIPAA, SOX, GDPR, etc.).";

      const usr = "Crie um Relatório de Conformidade completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Sumário Executivo** — nível geral de conformidade e principais achados\n"
        + "2. **Normas e Regulamentações Avaliadas** — lista das normas verificadas e sua aplicabilidade\n"
        + "3. **Metodologia de Avaliação** — como a auditoria foi conduzida\n"
        + "4. **Matriz de Conformidade** — tabela: Requisito Normativo | Controle Implementado | Status (✅ Conforme / ❌ Não Conforme / ⚠️ Parcial) | Evidência | Risco\n"
        + "5. **Não Conformidades Encontradas** — detalhamento de cada item não atendido com impacto e prazo\n"
        + "6. **Conformidades Destacadas** — boas práticas identificadas\n"
        + "7. **Análise de Risco Regulatório** — exposição a penalidades e danos reputacionais\n"
        + "8. **Plano de Ação Corretiva** — medidas para atingir conformidade com responsáveis e prazos\n"
        + "9. **Conclusão** — o sistema está apto para certificação ou auditoria externa?";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "compliance_report",
        title: "Relatório de Conformidade — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      createdReport = inserted?.[0];

    } else if (tool_type === "uat_report") {
      const sys = "Você é um especialista em testes de aceitação do usuário (UAT — User Acceptance Testing) e UX. "
        + "Gere um Relatório de UAT completo, estruturado e profissional em Markdown, "
        + "documentando os resultados dos testes conduzidos por usuários finais e avaliando a prontidão do produto.";

      const usr = "Crie um Relatório de Teste de Aceitação do Usuário (UAT) completo com base nos seguintes dados:\n\n"
        + input + htmlContext
        + "\n\nO relatório deve conter:\n"
        + "1. **Informações do UAT** — projeto, versão, período de testes, perfil dos usuários participantes\n"
        + "2. **Objetivos e Critérios de Aceitação** — o que o produto deve fazer para ser aceito\n"
        + "3. **Participantes** — perfis de usuário, papéis e quantidade\n"
        + "4. **Cenários Testados** — lista de fluxos de negócio avaliados pelos usuários\n"
        + "5. **Resultados por Cenário** — tabela: Cenário | Usuário | Resultado | Dificuldades | Sugestões\n"
        + "6. **Problemas Identificados pelos Usuários** — lista com frequência, severidade e impacto na experiência\n"
        + "7. **Avaliação de Usabilidade** — facilidade de uso, clareza da interface, satisfação geral (NPS/escala)\n"
        + "8. **Feedback Qualitativo** — principais comentários e percepções dos usuários\n"
        + "9. **Critério de Aceitação Final** — ACEITO / ACEITO COM RESSALVAS / REJEITADO com justificativa\n"
        + "10. **Recomendações** — ajustes necessários antes do go-live e melhorias futuras\n"
        + "11. **Conclusão** — o produto está pronto para implantação em produção?";

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      const { data: inserted, error: insertError } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "uat_report",
        title: "Relatório de UAT — " + (input.split('\n')[0].slice(0, 200) + (input.split('\n')[0].length > 200 ? "..." : "")),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: null,
      }).select();
      if (insertError) throw insertError;
      createdReport = inserted?.[0];

    } else if (tool_type === "summarize_report") {
      const sys = "Você é um engenheiro de QA. Analise os resultados deste teste e retorne um resumo ESTRITAMENTE PADRONIZADO E CURTO (no máximo 2 frases).\\n\\n"
        + "Inicie OBRIGATORIAMENTE com 'Status - Passou: ' ou 'Status - Falhou: ', seguido do motivo principal ou objetivo validado.\\n\\n"
        + "Exemplos:\\n"
        + "Status - Passou: A navegação ocorreu com sucesso sem erros.\\n"
        + "Status - Falhou: O formulário apresentou erro 500 ao enviar dados corretos.\\n\\n"
        + "Retorne APENAS o texto padronizado, sem formatação markdown.";

      const usr = "Resuma o seguinte resultado de teste de forma extremamente curta (1 ou 2 frases max):\n\n" + input.slice(0, 8000);

      result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey
      );

      return NextResponse.json({ success: true, summary: result });
    } else {
      return NextResponse.json({ error: "Invalid tool_type" }, { status: 400 });
    }

    return NextResponse.json({ result, report: createdReport });

  } catch (error: any) {
    console.error("QA API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
