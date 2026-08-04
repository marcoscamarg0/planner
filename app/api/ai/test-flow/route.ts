import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const AVAILABLE_MODELS: Record<string, string> = {
  "auto-free": "openrouter/free",
  "kimi-k2": "google/gemini-2.0-flash-exp:free",
  "nemotron-70b": "nvidia/nemotron-3-super-120b-a12b:free",
  "nemotron-super": "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen-coder": "qwen/qwen-2.5-coder-32b-instruct:free",
  "laguna-xs": "poolside/laguna-xs-2.1:free",
  "gpt-oss": "openai/gpt-oss-20b:free",
  "cohere-north": "cohere/north-mini-code:free",
};

async function callOpenRouter(messages: any[], modelKey: string, apiKey: string) {
  const model = AVAILABLE_MODELS[modelKey] || AVAILABLE_MODELS["auto-free"];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://planner-j53e.onrender.com",
      "X-Title": "Planner QA Suite",
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 3000 }),
  }).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const err = await response.text();
    throw new Error("OpenRouter error [" + response.status + "]: " + err);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

function robustJsonParse(text: string) {
  // Strip markdown code fences
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  // Try direct parse first
  try { return JSON.parse(clean); } catch {}
  // Try to extract outermost { ... }
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  return null;
}

/** Build a minimal React Flow graph from plain text steps (fallback when AI fails) */
function buildFallbackFlow(text: string): { nodes: any[]; edges: any[] } {
  const lines = text.split('\n')
    .map(l => l.replace(/^[\s\-\d\.\*]+/, '').trim())
    .filter(l => l.length > 8)
    .slice(0, 15);

  const nodes: any[] = [];
  const edges: any[] = [];

  lines.forEach((line, i) => {
    const type = i === 0 ? 'start' : i === lines.length - 1 ? 'validation' : 'action';
    nodes.push({ id: String(i + 1), type, position: { x: 250, y: 50 + i * 120 }, data: { label: line.slice(0, 60) } });
    if (i > 0) edges.push({ id: `e${i}-${i + 1}`, source: String(i), target: String(i + 1) });
  });

  // Ensure at least one node
  if (nodes.length === 0) {
    nodes.push({ id: '1', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Início' } });
    nodes.push({ id: '2', type: 'end', position: { x: 250, y: 200 }, data: { label: 'Fim' } });
    edges.push({ id: 'e1-2', source: '1', target: '2' });
  }

  return { nodes, edges };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { testCaseText, modelKey = "auto-free" } = await req.json();

    if (!testCaseText) {
      return NextResponse.json({ error: "O texto do caso de teste é obrigatório." }, { status: 400 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "Chave da API OpenRouter não configurada." }, { status: 500 });
    }

    const messages = [
      {
        role: "system",
        content: `Você é um engenheiro de QA especialista em automação e fluxos de teste.
Seu objetivo é transformar um texto em um fluxograma de React Flow.

IMPORTANTE: Retorne SOMENTE o objeto JSON abaixo, SEM markdown, SEM explicações, SEM blocos de código:
{"nodes":[{"id":"1","type":"start","position":{"x":250,"y":50},"data":{"label":"Início do Teste"}},{"id":"2","type":"action","position":{"x":250,"y":170},"data":{"label":"Preencher Email"}},{"id":"3","type":"decision","position":{"x":250,"y":290},"data":{"label":"Email Válido?"}},{"id":"4","type":"validation","position":{"x":100,"y":410},"data":{"label":"Login com Sucesso"}},{"id":"5","type":"error","position":{"x":400,"y":410},"data":{"label":"Erro de Login"}},{"id":"6","type":"end","position":{"x":250,"y":530},"data":{"label":"Fim"}}],"edges":[{"id":"e1-2","source":"1","target":"2"},{"id":"e2-3","source":"2","target":"3"},{"id":"e3-4","source":"3","target":"4","label":"Sim"},{"id":"e3-5","source":"3","target":"5","label":"Não"},{"id":"e4-6","source":"4","target":"6"},{"id":"e5-6","source":"5","target":"6"}]}

Regras OBRIGATÓRIAS:
1. "type" dos nodes DEVE ser um dos seguintes: "start" (início), "action" (ações do usuário, preencher, clicar), "decision" (condicionais if/else), "validation" (asserções e resultados esperados positivos), "error" (mensagens de erro, exceções), "end" (término do fluxo).
2. O espaçamento vertical ("y") dos nós sucessivos deve ser de 120px a 150px. Se usar "decision", espalhe as opções horizontalmente variando o "x".
3. id dos nodes: números em string ("1","2","3").
4. id das edges: "e{source}-{target}". Você pode adicionar um campo "label" nas edges que saem de um "decision" (ex: "Sim", "Não", "Sucesso", "Falha").
5. NÃO use markdown. Comece diretamente com { e termine com }`,
      },
      {
        role: "user",
        content: `Converta em fluxo React Flow (JSON puro, sem markdown):\n\n${testCaseText}`,
      }
    ];

    const content = await callOpenRouter(messages, modelKey, OPENROUTER_API_KEY);
    let parsed = robustJsonParse(content);

    // If AI failed to return valid flow, build a fallback from the input text
    if (!parsed || !parsed.nodes || !parsed.edges || parsed.nodes.length === 0) {
      console.warn("[TestFlow API] IA não retornou JSON válido, usando fallback. Raw:", content?.slice(0, 200));
      parsed = buildFallbackFlow(testCaseText);
    }

    return NextResponse.json({ success: true, flow: parsed, usedFallback: !content || !robustJsonParse(content) });
  } catch (error: any) {
    console.error("[TestFlow API] Erro:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
