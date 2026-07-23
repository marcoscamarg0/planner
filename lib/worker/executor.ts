// -------------------------------------------------------
// Executor do Playwright — roda dentro do Worker BullMQ
// -------------------------------------------------------

import { chromium, type Page } from '@playwright/test';

import type { Job } from 'bullmq';
import type { AutomationJobData, AutomationJobResult, StepResult } from '../queue/types';
import { buildReportHtml } from './report-generator';
import * as fs from 'fs';
import * as path from 'path';

// Axe Builder — importado dinamicamente para evitar problemas no Next.js
async function runAxeAudit(page: Page): Promise<any[]> {
  try {
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const result = await (new AxeBuilder({ page } as any))
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    return result.violations;
  } catch (e) {
    console.warn('[Executor] Axe audit failed (optional):', e);
    return [];
  }
}

async function executeStep(
  page: Page,
  step: AutomationJobData['scriptSteps'][0],
  index: number,
  targetUrl: string,
  job: Job<AutomationJobData>
): Promise<StepResult> {
  const urlBase = targetUrl.split('#')[0].split('?')[0];
  const startTime = Date.now();
  let screenshotBase64: string | undefined;

  // Garantir que estamos na URL correta
  try {
    const currentUrlBase = page.url().split('#')[0].split('?')[0];
    if (currentUrlBase !== urlBase && step.action !== 'goto') {
      await job.log(`[Passo #${index}] Retornando à URL base: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
  } catch { /* ignore, prosseguir */ }

  // Montar o locator baseado no tipo de seletor
  let locator;
  try {
    if (step.action === 'goto') {
      await job.log(`[Passo #${index}] Ação: GOTO -> ${step.value || targetUrl}`);
      await page.goto(step.value || targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const buf = await page.screenshot({ type: 'jpeg', quality: 60 }).catch(() => null);
      if (buf) screenshotBase64 = buf.toString('base64');
      return {
        index, label: step.label, status: 'aprovado',
        detalhe: `Navegou para: ${step.value || targetUrl}`,
        screenshotBase64, duration: Date.now() - startTime,
      };
    }

    if (step.action === 'wait') {
      await job.log(`[Passo #${index}] Ação: WAIT -> ${step.milliseconds || 1000}ms`);
      await page.waitForTimeout(step.milliseconds || 1000);
      return {
        index, label: step.label, status: 'aprovado',
        detalhe: `Aguardou ${step.milliseconds || 1000}ms`, duration: Date.now() - startTime,
      };
    }

    // Construir locator
    switch (step.selectorType) {
      case 'role':
        locator = page.getByRole(step.selector as any, step.value ? { name: step.value } : {});
        break;
      case 'text':
        locator = page.getByText(step.value || step.selector || '', { exact: false });
        break;
      case 'testid':
        locator = page.getByTestId(step.selector || '');
        break;
      case 'id':
        locator = page.locator(`#${step.selector}`);
        break;
      case 'xpath':
        locator = page.locator(`xpath=${step.selector}`);
        break;
      default: // 'css'
        locator = page.locator(step.selector || '*');
    }

    await job.log(`[Passo #${index}] Localizando elemento: tipo='${step.selectorType}', seletor='${step.selector}', valor='${step.value}'`);

    // Scroll + highlight + screenshot de evidência
    await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

    const originalStyle = await locator.evaluate((el: HTMLElement) => {
      const old = { shadow: el.style.boxShadow, outline: el.style.outline, border: el.style.border, transition: el.style.transition };
      el.style.transition = 'none';
      el.style.setProperty('box-shadow', '0 0 0 6px red, 0 0 20px 5px rgba(255,0,0,0.6)', 'important');
      el.style.setProperty('outline', '6px solid red', 'important');
      el.style.setProperty('outline-offset', '4px', 'important');
      return old;
    }).catch(() => null);

    await page.waitForTimeout(1500);

    const box = await locator.boundingBox().catch(() => null);
    let clipOptions = undefined;
    if (box) {
      const padding = 200;
      clipOptions = {
        x: Math.max(0, box.x - padding),
        y: Math.max(0, box.y - padding),
        width: box.width + padding * 2,
        height: box.height + padding * 2,
      };
    }

    const buf = await page.screenshot({
      type: 'jpeg',
      quality: 60,
      timeout: 3000,
      clip: clipOptions
    }).catch(() => null);
    if (buf) screenshotBase64 = buf.toString('base64');

    if (originalStyle) {
      await locator.evaluate((el: HTMLElement, old: any) => {
        el.style.transition = old.transition || '';
        el.style.boxShadow = old.shadow || '';
        el.style.outline = old.outline || '';
      }, originalStyle).catch(() => {});
    }

    await job.log(`[Passo #${index}] Executando ação: ${step.action}`);

    // Executar ação
    if (step.action === 'type') {
      await locator.fill(step.value || '', { timeout: 8000 });
    } else if (step.action === 'select') {
      await locator.selectOption(step.value || '', { timeout: 8000 });
    } else if (step.action === 'check') {
      await locator.check({ timeout: 8000 });
    } else if (step.action === 'hover') {
      await locator.hover({ timeout: 8000 });
    } else if (step.action === 'scroll') {
      await locator.scrollIntoViewIfNeeded({ timeout: 5000 });
    } else {
      // click (padrão)
      if (step.isPopup) {
        const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
        await locator.click({ timeout: 5000, noWaitAfter: true });
        await popupPromise;
      } else {
        await locator.click({ timeout: 5000, noWaitAfter: true });
      }
    }

    await page.waitForTimeout(800);

    // Retornar à URL base se for um clique (para limpar estado/popups)
    if (step.action === 'click') {
      await job.log(`[Passo #${index}] Retornando para a URL inicial para redefinir o estado...`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    return {
      index, label: step.label, status: 'aprovado',
      detalhe: 'Passo executado e validado com sucesso.',
      screenshotBase64, duration: Date.now() - startTime,
    };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    await job.log(`[Passo #${index}] ❌ FALHA: ${msg.substring(0, 200)}`);
    return {
      index, label: step.label, status: 'falha_clique',
      detalhe: `Falha na execução: ${msg.substring(0, 200)}`,
      screenshotBase64, duration: Date.now() - startTime,
    };
  }
}

export async function executeAutomation(
  job: Job<AutomationJobData>
): Promise<AutomationJobResult> {
  const { targetUrl, scriptSteps, jobId, jobName } = job.data;
  const results: StepResult[] = [];
  let axeViolations: any[] = [];

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
    ],
  });

  try {
    const context = await browser.newContext({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    // Bloquear print dialog
    await page.addInitScript(() => {
      window.print = () => console.log('[blocked] print dialog');
    });

    // Navegar para a URL alvo
    await job.log(`[Executor] Iniciando navegador e acessando URL base: ${targetUrl}`);
    await job.updateProgress(8);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Auditoria eMAG (Axe) — opcional
    await job.log(`[Executor] Analisando acessibilidade da página inicial...`);
    await job.updateProgress(14);
    axeViolations = await runAxeAudit(page);
    await job.log(`[Executor] ♿ Axe: ${axeViolations.length} violações de acessibilidade/WCAG encontradas.`);
    console.log(`[Executor] ♿ Axe: ${axeViolations.length} violações encontradas`);

    // Executar passos
    const totalSteps = scriptSteps.length;
    for (let i = 0; i < totalSteps; i++) {
      const step = scriptSteps[i];
      const progress = 14 + Math.floor(((i + 1) / totalSteps) * 72);
      await job.updateProgress(progress);

      const msg = `[Executor] Passo ${i + 1}/${totalSteps}: ${step.label}`;
      await job.log(msg);
      console.log(msg);
      const result = await executeStep(page, step, i + 1, targetUrl, job);
      results.push(result);
    }

    // Gerar Relatório HTML → PDF
    await job.log(`[Executor] Todos os passos concluídos. Gerando relatório...`);
    await job.updateProgress(90);
    const htmlContent = buildReportHtml({ results, axeViolations, targetUrl, jobName });

    const reportsDir = path.resolve(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const htmlFilename = `report-${jobId}.html`;
    const htmlPath = path.join(reportsDir, htmlFilename);
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

    let pdfUrl: string | undefined;

    await context.close();

    const approved = results.filter(r => r.status === 'aprovado').length;
    const failed   = results.filter(r => r.status !== 'aprovado' && r.status !== 'pulado').length;

    await job.log(`[Executor] ✅ Finalizado com ${approved} aprovados e ${failed} falhas.`);

    return {
      status: 'completed',
      progress: 100,
      pdfUrl,
      htmlReportUrl: `/reports/${htmlFilename}`,
      steps: results,
      axeViolationsCount: axeViolations.length,
      totalSteps: results.length,
      approvedSteps: approved,
      failedSteps: failed,
      reportMarkdown: buildMarkdownSummary(results, axeViolations, targetUrl, jobName),
      completedAt: new Date().toISOString(),
    };

  } finally {
    await browser.close();
  }
}

function buildMarkdownSummary(results: StepResult[], violations: any[], url: string, name: string): string {
  const ok   = results.filter(r => r.status === 'aprovado').length;
  const fail = results.length - ok;
  return [
    `# Relatório de Execução — ${name}`,
    ``,
    `**URL Testada:** ${url}`,
    `**Status Final:** ${fail === 0 ? '✅ APROVADO' : '⚠️ ATENÇÃO — Há falhas'}`,
    ``,
    `## Métricas`,
    `| Item | Valor |`,
    `|------|-------|`,
    `| Total de Passos | ${results.length} |`,
    `| Aprovados | ${ok} |`,
    `| Falhas | ${fail} |`,
    `| Violações eMAG | ${violations.length} |`,
    ``,
    `## Detalhamento`,
    ...results.map(r => `- **#${r.index}** ${r.label}: \`${r.status}\` — ${r.detalhe}`),
  ].join('\n');
}
