// -------------------------------------------------------
// POST /api/automation/run
// Enfileira um job de automação no BullMQ (Redis)
// -------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQueue } from '@/lib/queue/queue';
import type { AutomationJobData, AutomationStep } from '@/lib/queue/types';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Traduz código de automação em passos estruturados via IA
async function translateScriptToSteps(
  scriptCode: string,
  targetUrl: string
): Promise<AutomationStep[]> {
  if (!OPENROUTER_API_KEY) {
    return [{ action: 'goto', label: 'Acessar URL', value: targetUrl }];
  }

  const systemPrompt = `Você é um interpretador de scripts de automação web. 
Dado um script Playwright/Cypress/Selenium, extraia uma lista de passos de automação como JSON.
Retorne SOMENTE um JSON válido no formato:
{
  "steps": [
    {
      "action": "goto|click|type|wait|select|check|hover|scroll",
      "label": "Descrição amigável do passo",
      "selectorType": "role|text|css|id|testid",
      "selector": "nome do role ou seletor CSS",
      "value": "URL para goto, texto para type, nome para role/getByText",
      "milliseconds": 1000,
      "isPopup": false
    }
  ]
}
Regras:
- Para page.getByRole('button', {name: 'X'}): action=click, selectorType=role, selector=button, value=X
- Para page.getByRole('link', {name: 'X'}): action=click, selectorType=role, selector=link, value=X
- Para page.getByText('X'): action=click, selectorType=text, value=X
- Para page.locator('#id'): action=click, selectorType=id, selector=id-sem-hash
- Para page.goto('URL'): action=goto, value=URL
- Para isPopup: defina true quando o código original passa {isPopup: true} ou o passo abre uma nova janela`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://planner-j53e.onrender.com',
        'X-Title': 'Planner QA Suite',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Traduz este script para rodar em ${targetUrl}:\n\n${scriptCode.substring(0, 12000)}` },
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const cleaned = jsonMatch ? jsonMatch[0] : content.replace(/```json\n?|\n?```/g, '').trim();
      
      if (!cleaned) throw new Error("A IA retornou conteúdo vazio.");
      const parsed = JSON.parse(cleaned);
      if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        return parsed.steps as AutomationStep[];
      }
    }
  } catch (err) {
    console.error('[AutomationRun] Falha ao traduzir script via IA:', err);
  }

  // Fallback: apenas navegar para a URL
  return [{ action: 'goto', label: 'Acessar URL', value: targetUrl }];
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const { targetUrl, scriptCode, scriptSteps, jobName } = body;

    if (!targetUrl) {
      return NextResponse.json({ error: 'targetUrl é obrigatório' }, { status: 400 });
    }

    // Usar os passos fornecidos diretamente ou traduzir o código
    let steps: AutomationStep[] = [];
    if (scriptSteps && Array.isArray(scriptSteps) && scriptSteps.length > 0) {
      steps = scriptSteps;
    } else if (scriptCode) {
      steps = await translateScriptToSteps(scriptCode, targetUrl);
    } else {
      return NextResponse.json({ error: 'Forneça scriptCode ou scriptSteps' }, { status: 400 });
    }

    const jobId = randomUUID();

    const jobData: AutomationJobData = {
      jobId,
      jobName: jobName || `Automação ${new URL(targetUrl).hostname}`,
      targetUrl,
      scriptCode,
      scriptSteps: steps,
      requestedAt: new Date().toISOString(),
      userId: user.id,
    };

    // Enfileirar no BullMQ
    const queue = getQueue();
    await queue.add('run', jobData, { jobId });

    console.log(`[AutomationRun] ✅ Job ${jobId} enfileirado (${steps.length} passos)`);

    return NextResponse.json({
      jobId,
      jobName: jobData.jobName,
      totalSteps: steps.length,
      steps: steps.map(s => ({ label: s.label, action: s.action })),
      statusUrl: `/api/automation/status/${jobId}`,
      message: `Job enfileirado com sucesso. ${steps.length} passos a executar.`,
    });

  } catch (err: unknown) {
    console.error('[AutomationRun] Erro:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
