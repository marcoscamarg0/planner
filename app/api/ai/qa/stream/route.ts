import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const AVAILABLE_MODELS: Record<string, string> = {
  "auto-free": "openrouter/free",
  "kimi-k2": "google/gemini-2.0-flash-exp:free",
  "nemotron-70b": "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen-coder": "qwen/qwen-2.5-coder-32b-instruct:free",
  "laguna-xs": "poolside/laguna-xs-2.1:free",
  "gpt-oss": "openai/gpt-oss-20b:free",
  "cohere-north": "cohere/north-mini-code:free",
};

const FALLBACK_MODELS = [
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "cohere/north-mini-code:free",
  "openrouter/free",
];

async function callSingleModel(messages: any[], model: string, apiKey: string, timeoutMs = 40000): Promise<string> {
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
  const requestedModel = AVAILABLE_MODELS[modelKey] || AVAILABLE_MODELS["auto-free"];
  const chain = [requestedModel, ...FALLBACK_MODELS.filter(m => m !== requestedModel)];

  let lastError: any;
  for (const model of chain) {
    try {
      console.log(`[QA Stream API] Trying model: ${model}`);
      if (logToStream) await logToStream(`[LOG] Tentando modelo: ${model}`);
      const result = await callSingleModel(messages, model, apiKey);
      if (model !== requestedModel) {
        if (logToStream) await logToStream(`[LOG] Sucesso com o modelo de fallback: ${model}`);
      }
      return result;
    } catch (err: any) {
      lastError = err;
      const isRetryable = err.status === 404 || err.status === 429 || err.status === 408 || err.status >= 500 || (err.message && (err.message.includes("404") || err.message.includes("429") || err.message.includes("502")));
      const isAbort = err.name === "AbortError";
      if (isRetryable || isAbort) {
        if (logToStream) await logToStream(`[LOG] Falha no modelo ${model} (${isAbort ? "timeout" : "erro " + err.status}), tentando próximo...`);
        continue;
      }
      break;
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      if (logToStream) await logToStream("[LOG] OpenRouter falhou completamente. Tentando Groq fallback (llama-3.3-70b-versatile)...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40000);
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": "Bearer " + groqKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, temperature: 0.2, max_tokens: 8000 }),
      }).finally(() => clearTimeout(timeoutId));
      
      if (!response.ok) throw new Error("Groq API Error: " + response.status);
      const data = await response.json();
      return data.choices[0]?.message?.content || "";
    } catch (groqErr: any) {
      if (logToStream) await logToStream("[LOG] Erro fatal também no Groq: " + groqErr.message);
      lastError = groqErr;
    }
  }
  throw lastError || new Error("All models failed");
}

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const logToStream = async (message: string) => {
    console.log(message);
    try { await writer.write(encoder.encode(JSON.stringify({ type: 'log', message }) + '\\n')); } catch (e) {}
  };

  (async () => {
    try {
      await logToStream("[LOG] Autenticando e preparando geração...");
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const body = await req.json();
      const { tool_type, input, model = "auto-free", project_id = "" } = body;

      if (tool_type !== "test_cases") {
        throw new Error("Only test_cases is supported on the stream endpoint");
      }

      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

      let processedInput = input;
      const isPlaywrightJsonl = input.trim().startsWith('{"browserName"') || input.trim().startsWith('{"name":"openPage"') || (input.includes('"name":"click"') && input.includes('"name":"navigate"'));
      if (isPlaywrightJsonl) {
        try {
          const lines = input.split('\\n').filter((l: string) => l.trim().startsWith('{'));
          const actions: any[] = lines.map((l: string) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

          const baseUrl = actions.find((a: any) => a.name === 'navigate' && a.pageAlias === 'page')?.url
            || actions.find((a: any) => a.name === 'openPage' && a.url)?.url || '';

          const journeys: { trigger: string; steps: string[]; destination: string }[] = [];
          let currentJourney: { trigger: string; steps: string[]; destination: string } | null = null;

          const describeAction = (a: any): string => {
            const label = a.locator?.body || a.locator?.options?.name || a.selector || '';
            if (a.name === 'navigate') return `Navega para: ${a.url}`;
            if (a.name === 'click') return `Clica em "${label}"`;
            if (a.name === 'fill' || a.name === 'type') return `Preenche "${label}" com "${a.value || a.text || ''}"`;
            if (a.name === 'closePage') return `Fecha aba`;
            if (a.name === 'press') return `Pressiona "${a.key}"`;
            if (a.name === 'scroll') return `Rola a página`;
            if (a.name === 'check') return `Marca checkbox "${label}"`;
            if (a.name === 'select') return `Seleciona "${a.value}" em "${label}"`;
            return `${a.name}: ${label}`;
          };

          for (const a of actions) {
            if (a.name === 'browserName' || a.name === 'openPage' && !a.url) continue;

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

          const scenariosText = journeys.map((j, i) =>
            `Cenário ${i + 1}: ${j.trigger}\\n  URL de destino: ${j.destination || '(mesma página)'}\\n  Passos: ${j.steps.slice(0, 8).join(' → ')}`
          ).join('\\n\\n');

          processedInput = `Site testado: ${baseUrl}\\nTotal de cenários gravados: ${journeys.length}\\n\\n=== CENÁRIOS ===\\n\\n${scenariosText}`;
        } catch (e) {
          processedInput = input;
        }
      }

      const sys = "Você é um Engenheiro de QA Sênior especialista em testes end-to-end.\\n" +
        "Sua tarefa é analisar os cenários gravados e gerar uma suíte de casos de teste REAIS E PROFISSIONAIS em formato JSON.\\n" +
        "REGRA CRÍTICA: FILTRE e IGNORE cenários inúteis, repetitivos ou sem sentido, como 'clicar num link e permanecer na mesma página' ou 'fechar aba sem contexto'. Crie casos de teste APENAS para fluxos funcionais reais, lógicos e que tenham valor de negócio.\\n" +
        "Os títulos devem ser profissionais, diretos e focados na ação (ex: 'Validar redirecionamento para X', 'Testar preenchimento de Y').\\n" +
        "Retorne APENAS um bloco de código JSON válido, sem NENHUM texto antes ou depois.\\n" +
        "O JSON deve seguir EXATAMENTE esta estrutura:\\n" +
        `[\n  {\n    "title": "Nome do Caso de Teste",\n    "description": "Descrição detalhada do objetivo",\n    "steps": [\n      "Passo 1: Fazer X",\n      "Passo 2: Fazer Y"\n    ],\n    "expected_result": "Resultado esperado após a execução",\n    "priority": "high" // ou "medium" ou "low"\n  }\n]`;
      
      const usr = `Analise os cenários abaixo e crie casos de teste APENAS para os fluxos que fazem sentido e têm relevância (filtre o lixo).\\n\\n`
        + processedInput + "\\n\\nRetorne apenas o JSON com os casos de teste selecionados.";

      await logToStream("[LOG] Analisando requisitos e chamando IA...");
      const result = await callOpenRouter(
        [{ role: "system", content: sys }, { role: "user", content: usr }],
        model, apiKey, logToStream
      );

      await logToStream("[LOG] Resposta da IA recebida. Processando JSON...");
      
      let parsedResult = null;
      try {
        const jsonMatch = result.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[1]);
        } else {
          parsedResult = JSON.parse(result);
        }
        if (!Array.isArray(parsedResult)) parsedResult = [parsedResult];
      } catch (e) {
        await logToStream("[LOG] Aviso: Falha ao fazer parse estrito do JSON. Os casos de teste podem ter formato incorreto.");
      }

      await logToStream("[LOG] Salvando relatório no banco de dados...");
      const { data: inserted, error: insertError } = await supabase.from("qa_reports").insert({
        user_id: user.id,
        project_id: project_id || null,
        type: "test_cases",
        title: "Casos de Teste — " + (input.split('\\n')[0].slice(0, 100)),
        input_description: input,
        framework: null,
        model_used: model,
        result_raw: result,
        result_json: { test_cases: parsedResult || [] },
      }).select();
      
      if (insertError) throw insertError;
      const createdReport = inserted?.[0];

      if (parsedResult && Array.isArray(parsedResult) && project_id) {
        await logToStream("[LOG] Sincronizando novos casos como tarefas pendentes (todo)...");
        for (const tc of parsedResult) {
          await supabase.from("tasks").insert({
            user_id: user.id,
            project_id: project_id,
            title: "[QA] " + tc.title,
            description: tc.description + "\\n\\n**Passos:**\\n" + (tc.steps || []).map((s:any, i:number) => (i+1)+". "+s).join("\\n") + "\\n\\n**Resultado Esperado:** " + tc.expected_result,
            status: "todo",
            priority: tc.priority === "high" ? "high" : tc.priority === "medium" ? "medium" : "low"
          });
        }
      }

      await logToStream("[LOG] Concluído!");
      await writer.write(encoder.encode(JSON.stringify({ type: 'result', result, report: createdReport }) + '\\n'));

    } catch (error: any) {
      console.error("Stream error:", error);
      await writer.write(encoder.encode(JSON.stringify({ error: error.message || "Internal server error" }) + '\\n'));
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' }
  });
}
