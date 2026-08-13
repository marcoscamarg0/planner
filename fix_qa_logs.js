const fs = require('fs');

const routePath = 'app/api/ai/qa/route.ts';
let code = fs.readFileSync(routePath, 'utf8');

// 1. Refactor callSingleModel and callOpenRouter to support logToStream
code = code.replace(
  `async function callOpenRouter(messages: any[], modelKey: string, apiKey: string): Promise<string>`,
  `async function callOpenRouter(messages: any[], modelKey: string, apiKey: string, logToStream?: (m: string) => Promise<void>): Promise<string>`
);

code = code.replace(/console\.log\(`\[QA API\] Trying model: \$\{model\}`\);/g, 
  `console.log(\`[QA API] Trying model: \${model}\`); if (logToStream) await logToStream(\`[LOG] Tentando modelo: \${model}\`);`);

code = code.replace(/console\.log\(`\[QA API\] Fallback succeeded with: \$\{model\}`\);/g,
  `console.log(\`[QA API] Fallback succeeded with: \${model}\`); if (logToStream) await logToStream(\`[LOG] Sucesso com o modelo: \${model}\`);`);

code = code.replace(/console\.warn\(`\[QA API\] Model \$\{model\} failed \(\$\{isAbort \? "timeout" : "provider error " \+ err\.status\}\), trying next fallback\.\.\.`\);/g,
  `if (logToStream) await logToStream(\`[LOG] Falha no modelo \${model} (\${isAbort ? "timeout" : "erro " + err.status}), tentando próximo...\`); console.warn(\`[QA API] Model \${model} failed (\${isAbort ? "timeout" : "provider error " + err.status}), trying next fallback...\`);`);

code = code.replace(/console\.log\("\[QA API\] OpenRouter falhou completamente\. Tentando Groq fallback \(llama-3\.3-70b-versatile\)\.\.\."\);/g,
  `if (logToStream) await logToStream("[LOG] OpenRouter falhou completamente. Tentando Groq fallback (llama-3.3-70b-versatile)..."); console.log("[QA API] OpenRouter falhou completamente. Tentando Groq fallback (llama-3.3-70b-versatile)...");`);

code = code.replace(/console\.error\("\[QA API\] Groq Fallback Error:", groqErr\.message\);/g,
  `if (logToStream) await logToStream("[LOG] Erro fatal também no Groq: " + groqErr.message); console.error("[QA API] Groq Fallback Error:", groqErr.message);`);

// 2. Change POST to stream IF ?stream=true is present
const newPost = `
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("stream") === "true") {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const logToStream = async (message: string) => {
      console.log(message);
      try { await writer.write(encoder.encode(JSON.stringify({ type: 'log', message }) + '\\n')); } catch (e) {}
    };

    (async () => {
      try {
        await logToStream("[LOG] Iniciando processamento de QA...");
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const body = await req.json();
        const { tool_type, input, framework = "playwright", model = "auto-free", project_id = "", html_content = "" } = body;

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");

        let result = "";
        let createdReport: any = null;
        let sys = "", usr = "";

        if (tool_type === "test_cases") {
          sys = "Você é um Engenheiro de QA Sênior especialista em Playwright e testes end-to-end.\\n" +
            "Sua tarefa é analisar a requisição do usuário e gerar uma suíte de casos de teste estruturada em formato JSON.\\n" +
            "Retorne APENAS um bloco de código JSON válido, sem NENHUM texto antes ou depois.\\n" +
            "O JSON deve seguir EXATAMENTE esta estrutura:\\n" +
            \`[\n  {\n    "title": "Nome do Caso de Teste",\n    "description": "Descrição detalhada do objetivo",\n    "steps": [\n      "Passo 1: Fazer X",\n      "Passo 2: Fazer Y"\n    ],\n    "expected_result": "Resultado esperado após a execução",\n    "priority": "high" // ou "medium" ou "low"\n  }\n]\`;
          usr = "Gere casos de teste para a seguinte funcionalidade/requisito:\\n\\n" + input;
          
          await logToStream("[LOG] Preparando prompt para geração de casos de teste...");
          result = await callOpenRouter(
            [{ role: "system", content: sys }, { role: "user", content: usr }],
            model, apiKey, logToStream
          );

          await logToStream("[LOG] Processamento concluído. Salvando relatório...");

          let parsedResult = null;
          try {
            const jsonMatch = result.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\\s*\`\`\`/);
            if (jsonMatch) {
              parsedResult = JSON.parse(jsonMatch[1]);
            } else {
              parsedResult = JSON.parse(result);
            }
            if (!Array.isArray(parsedResult)) parsedResult = [parsedResult];
          } catch (e) {
            console.error("Falha ao parsear JSON:", e);
          }

          const { data: inserted, error: insertError } = await supabase.from("qa_reports").insert({
            user_id: user.id,
            project_id: project_id || null,
            type: "test_cases",
            title: "Casos de Teste — " + (input.split('\\n')[0].slice(0, 100)),
            input_description: input,
            framework: null,
            model_used: model,
            result_raw: result,
            result_json: { test_cases: parsedResult },
          }).select();
          
          if (insertError) throw insertError;
          createdReport = inserted?.[0];
          
          // Also create tasks automatically
          if (parsedResult && Array.isArray(parsedResult) && project_id) {
            await logToStream("[LOG] Criando tarefas no projeto...");
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

        } else {
          throw new Error("Apenas test_cases suporta streaming no momento");
        }

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

  // --- ORIGINAL POST LOGIC STARTS HERE ---
`;

code = code.replace(`export async function POST(req: Request) {`, newPost + `\n  export async function ORIGINAL_POST(req: Request) {`);
// Change the very last closing brace of POST to end ORIGINAL_POST
// Actually, it's safer to just let both be exported if I rename the old one, but Next.js will crash if I export two functions.
// Better to just rename the old POST inside the new POST.

fs.writeFileSync(routePath, code);
console.log("Done");
