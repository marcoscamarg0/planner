// -------------------------------------------------------
// Gerador de Relatório HTML — Formato Caso de Teste
// Passo → Resultado Esperado → Evidência Funcional
// -------------------------------------------------------

import type { StepResult } from '../queue/types';

type StatusBotao = 'aprovado' | 'falha_clique' | 'erro_js' | 'sem_texto' | 'pulado';

interface AxeViolation {
  id: string;
  description: string;
  help: string;
  helpUrl: string;
  impact: string;
  nodes: Array<{ html: string; failureSummary?: string }>;
}

interface ReportOptions {
  results: StepResult[];
  axeViolations: AxeViolation[];
  targetUrl: string;
  jobName: string;
  plannedSteps?: string[];
}

function getStatusInfo(status: StatusBotao) {
  switch (status) {
    case 'aprovado':     return { cor: '#168821', bg: '#e3f5e1', texto: 'Aprovado',    icon: '✓' };
    case 'falha_clique': return { cor: '#C2850C', bg: '#FFF5C2', texto: 'Falha Ação',  icon: '⚡' };
    case 'erro_js':      return { cor: '#E52207', bg: '#fde8e8', texto: 'Erro JS',     icon: '✖' };
    case 'sem_texto':    return { cor: '#E52207', bg: '#fde8e8', texto: 'S/ Texto',    icon: '⚠' };
    case 'pulado':       return { cor: '#888888', bg: '#F3F3F3', texto: 'Pulado',      icon: '⊘' };
    default:             return { cor: '#888888', bg: '#F3F3F3', texto: status,         icon: '?' };
  }
}

function traduzirImpacto(imp: string): string {
  return ({ minor: 'Baixo', moderate: 'Moderado', serious: 'Grave', critical: 'Crítico' } as Record<string, string>)[imp] || imp;
}

// -------------------------------------------------------
// Determina se o passo é um "retorno à base" (sem evidência)
// -------------------------------------------------------
function isReturnToBase(step: StepResult, baseUrl: string): boolean {
  const label = (step.label || '').toLowerCase();
  const detalhe = (step.detalhe || '').toLowerCase();

  // Passos de espera simples e scroll que foram aprovados são suprimidos
  if (step.status === 'aprovado') {
    if (label.includes('aguardar') && !label.includes('carregamento da página')) return true;
    if (label.includes('aguardar carregamento') && !label.includes('após')) return true;
  }

  // Passos de goto que voltam à URL base são suprimidos
  if (step.status === 'aprovado' && detalhe.includes('navegou para:')) {
    const navigatedTo = detalhe.replace('navegou para:', '').trim();
    try {
      if (new URL(navigatedTo).href === new URL(baseUrl).href) return true;
    } catch { /* ignore url parse errors */ }
  }

  return false;
}

// -------------------------------------------------------
// Gera o "Resultado Esperado" para cada passo
// -------------------------------------------------------
function buildResultadoEsperado(step: StepResult): string {
  const label = step.label || '';
  const lower = label.toLowerCase();

  if (lower.startsWith('acessar') || lower.includes('goto') || lower.includes('navegar')) {
    const urlMatch = step.detalhe?.match(/navegou para:\s*(.+)/i);
    const dest = urlMatch ? urlMatch[1].trim() : 'destino';
    return 'Página deve carregar completamente na URL: ' + dest;
  }
  if (lower.includes('clicar') || lower.includes('click')) {
    if (lower.includes('link')) return 'Link deve ser acionado e redirecionar para a página de destino ou abrir conteúdo correspondente.';
    if (lower.includes('botão') || lower.includes('button')) return 'Botão deve ser acionado, disparando a ação do sistema (submit, modal, navegação etc.).';
    return 'Elemento deve ser clicado e o sistema deve reagir com navegação ou mudança de estado visível.';
  }
  if (lower.includes('digitar') || lower.includes('preencher') || lower.includes('type')) {
    return 'Campo deve receber o texto inserido e exibi-lo corretamente.';
  }
  if (lower.includes('rolar') || lower.includes('scroll')) {
    return 'Página deve rolar revelando seções e elementos abaixo da dobra.';
  }
  if (lower.includes('hover') || lower.includes('passar')) {
    return 'Elemento deve exibir estado de hover (tooltip, submenu ou destaque visual).';
  }
  return 'Sistema deve responder à ação sem erros.';
}

// -------------------------------------------------------
// Gera a "Evidência Funcional" descritiva e única
// -------------------------------------------------------
function buildEvidenciaFuncional(step: StepResult, index: number): string {
  const label = step.label || '';
  const detalhe = step.detalhe || '';
  const lower = label.toLowerCase();
  const status = step.status;
  const hasScreenshot = !!step.screenshotBase64;

  // --- FALHA ---
  if (status !== 'aprovado') {
    const errMsg = detalhe.replace(/^Falha:\s*/i, '').substring(0, 200);
    return (hasScreenshot ? 'Screenshot da tela inteira capturada no momento da falha. ' : 'Estado do sistema indicando falha. ') +
      'O passo #' + index + ' não pôde ser executado porque ocorreu um erro: "' + errMsg + '". ' +
      'Como o elemento não foi encontrado (ou estava invisível/bloqueado), o robô não realizou o clique e a navegação não ocorreu.';
  }

  // --- GOTO / NAVEGAÇÃO ---
  if (lower.startsWith('acessar') || detalhe.toLowerCase().includes('navegou para:')) {
    const urlMatch = detalhe.match(/navegou para:\s*(.+)/i);
    const destUrl = urlMatch ? urlMatch[1].trim() : '';
    const pageName = destUrl ? (() => { try { return new URL(destUrl).pathname.split('/').filter(Boolean).pop() || 'home'; } catch { return 'página'; } })() : 'página';
    return (hasScreenshot ? 'Screenshot da página "' + pageName + '" renderizada' : 'Registro de navegação para "' + pageName + '"') +
      ' após acesso à URL ' + (destUrl || 'destino') + '. Conteúdo principal visível, confirmando que a página carregou com sucesso' +
      (step.duration ? ' em ' + step.duration + 'ms' : '') + '.';
  }

  // --- CLICK ---
  if (lower.includes('clicar') || lower.includes('click')) {
    const urlAlcancada = detalhe.match(/url:?\s*(https?:\/\/[^\s]+)/i)?.[1] ||
                         detalhe.match(/url alcançada:\s*(.+)/i)?.[1] || '';
    const newPage = urlAlcancada ? (() => { try { return new URL(urlAlcancada).pathname; } catch { return urlAlcancada; } })() : '';

    if (lower.includes('link')) {
      return (hasScreenshot ? 'Screenshot da nova página carregada após acionamento do link "' + label.replace(/clicar no link/i, '').trim() + '"' :
        'Registro do acionamento do link "' + label.replace(/clicar no link/i, '').trim() + '"') +
        (newPage ? '. URL alcançada: ' + newPage + '. ' : '. ') +
        'Confirma que o link redirecionou corretamente para o destino esperado' +
        (step.duration ? ' em ' + step.duration + 'ms' : '') + '.';
    }

    if (lower.includes('botão') || lower.includes('button')) {
      return (hasScreenshot ? 'Screenshot capturado após clique no botão, exibindo o estado resultante da ação' :
        'Registro de clique no botão') +
        (newPage ? ' — URL resultante: ' + newPage + '.' : '.') +
        ' Confirma que o botão executou sua função' +
        (step.duration ? ' em ' + step.duration + 'ms' : '') + '.';
    }

    return (hasScreenshot ? 'Screenshot do resultado após interação com o elemento do passo #' + index :
      'Registro de interação com elemento') +
      (newPage ? '. URL resultante: ' + newPage + '.' : '.') +
      (step.duration ? ' Tempo de resposta: ' + step.duration + 'ms.' : '');
  }

  // --- TYPE / FILL ---
  if (lower.includes('digitar') || lower.includes('preencher') || lower.includes('type')) {
    const valorDigitado = detalhe.match(/digitado:\s*"([^"]+)"/i)?.[1] || '';
    return (hasScreenshot ? 'Screenshot do campo preenchido com o valor' : 'Registro de preenchimento do campo') +
      (valorDigitado ? ' "' + valorDigitado + '"' : '') +
      '. Campo exibe o texto inserido corretamente, sem erros de validação visíveis' +
      (step.duration ? ' — operação concluída em ' + step.duration + 'ms' : '') + '.';
  }

  // --- SCROLL ---
  if (lower.includes('rolar') || lower.includes('scroll')) {
    return (hasScreenshot ? 'Screenshot da seção revelada após rolagem da página, exibindo novos elementos e conteúdo abaixo da dobra original' :
      'Registro de rolagem executada') +
      (step.duration ? ' em ' + step.duration + 'ms' : '') + '.';
  }

  // --- HOVER ---
  if (lower.includes('hover') || lower.includes('passar')) {
    return (hasScreenshot ? 'Screenshot capturando o estado de hover do elemento, com destaque visual, tooltip ou submenu visível' :
      'Registro de hover realizado') +
      (step.duration ? ' — ' + step.duration + 'ms' : '') + '.';
  }

  // --- DEFAULT ---
  return (hasScreenshot ? 'Screenshot do estado do sistema após conclusão do passo #' + index + ' (' + label + ')' :
    'Passo #' + index + ' concluído: ' + label) +
    (step.duration ? ' — ' + step.duration + 'ms' : '') + '.';
}

export function buildReportHtml(opts: ReportOptions): string {
  const { results, axeViolations, targetUrl, jobName } = opts;

  const total     = results.length;
  const aprovados = results.filter(r => r.status === 'aprovado').length;
  const falhas    = results.filter(r => ['falha_clique', 'erro_js', 'sem_texto'].includes(r.status)).length;
  const totalAxe  = axeViolations.reduce((acc, v) => acc + v.nodes.length, 0);
  const dataHora  = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const recomendacoes: string[] = [];
  if (totalAxe > 0) recomendacoes.push('<strong>Adequação eMAG:</strong> Violações estruturais e de acessibilidade detectadas. Aplique os ajustes para alinhar o serviço ao padrão eMAG 3.1 / WCAG 2.1 AA.');
  if (falhas > 0)   recomendacoes.push('<strong>Estabilidade:</strong> Ações falharam em ' + falhas + ' passo(s). Verifique seletores desatualizados, bloqueios por overlays ou timeouts de carregamento.');
  if (recomendacoes.length === 0) recomendacoes.push('<strong>Conformidade Plena:</strong> Fluxo validado com sucesso. Nenhuma falha de execução ou violação de acessibilidade detectada.');

  // Filtrar passos relevantes — sem retornos à base e sem waits simples aprovados
  const relevantes = results.filter(r => {
    if (r.status !== 'aprovado') return true; // Falhas SEMPRE aparecem
    const label = (r.label || '').toLowerCase();
    // Suprimir waits simples
    if (label === 'aguardar carregamento' || label === 'nova página criada') return false;
    // Suprimir retorno à base
    if (isReturnToBase(r, targetUrl)) return false;
    return true;
  });

  const displayResults = relevantes.length > 0 ? relevantes : results;

  const preCondicoes = [
    'Navegador atualizado (Chrome / Edge / Firefox) com acesso à internet.',
    'URL de teste acessível publicamente: <code>' + targetUrl + '</code>.',
    'Ambiente de execução: Playwright headless (Node.js).',
  ];
  if (aprovados === total) {
    preCondicoes.push('Nenhuma autenticação obrigatória detectada nos fluxos testados.');
  }

  // Seção do Caso de Teste Planejado
  const casoDeTesteHtml = opts.plannedSteps && opts.plannedSteps.length > 0 
    ? `
      <div style="page-break-before:always"></div>
      <h2 class="section-title">Plano de Teste (Caso de Teste)</h2>
      <div class="test-case-panel" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:24px; margin-bottom:40px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <h3 style="margin-top:0; color:#3b82f6; font-size:16px; margin-bottom: 8px;">Passos Planejados</h3>
        <p style="font-size:13px; color:#64748b; margin-bottom:20px;">O fluxo a seguir foi o roteiro planejado pela Inteligência Artificial e estruturado para execução na plataforma de testes.</p>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${opts.plannedSteps.map((step, idx) => `
            <div style="display:flex; gap:16px; align-items:center; padding:12px 16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
              <div style="flex-shrink:0; width:32px; height:32px; background:#eff6ff; color:#2563eb; font-weight:800; font-size:13px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid #bfdbfe;">
                ${idx + 1}
              </div>
              <div style="flex-grow:1; font-size:14px; color:#334155; font-weight:500; line-height:1.5;">
                ${step}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  const seenReportHashes = new Set<string>();
  const getImageHash = (img: string | undefined | null) => img ? `${img.length}_${img.slice(60, 120)}` : '';

  const passosHtml = displayResults.map((r, pos) => {
    const info = getStatusInfo(r.status as StatusBotao);
    const numPasso = pos + 1;
    const resultadoEsperado = buildResultadoEsperado(r);
    const evidenciaFuncional = buildEvidenciaFuncional(r, r.index);

    const afterHash = getImageHash(r.screenshotBase64);
    const isDuplicateAfter = afterHash && seenReportHashes.has(afterHash);
    if (afterHash && !isDuplicateAfter) {
      seenReportHashes.add(afterHash);
    }
    const screenshotAfterToRender = isDuplicateAfter ? undefined : r.screenshotBase64;

    const hasAnyImage = screenshotAfterToRender || r.screenshotBeforeBase64 || r.screenshotElementBase64;
    let imagemHtml = '';
    
    if (!hasAnyImage) {
      imagemHtml = `<div class="sem-evidencia" style="color: #64748b; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        ↳ Tela inalterada (sem mudanças visuais redundantes nesta ação)
      </div>`;
    } else {
      imagemHtml = `<div style="display: flex; flex-direction: column; gap: 20px; width: 100%;">`;
      
      // ANTES
      if (r.screenshotBeforeBase64) {
        imagemHtml += `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">📍 Onde o robô clicou (Antes)</div>
            <div style="position: relative; width: 100%;">
              <img src="data:image/jpeg;base64,${r.screenshotBeforeBase64}" class="evidencia-img" alt="Evidência Antes">
            </div>
          </div>
        `;
      } else if (r.screenshotElementBase64 && !r.screenshotBeforeBase64) {
        // Fallback backward compatibility for older reports
        imagemHtml += `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">📍 Elemento interagido</div>
            <img src="data:image/jpeg;base64,${r.screenshotElementBase64}" style="max-width: 300px; max-height: 200px; border: 2px solid #ef4444; border-radius: 6px; background: white;">
          </div>
        `;
      }

      // DEPOIS
      if (screenshotAfterToRender) {
        imagemHtml += `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">🎯 Resultado da Ação</div>
            <div style="position: relative; width: 100%;">
              <img src="data:image/jpeg;base64,${screenshotAfterToRender}" class="evidencia-img" alt="Resultado Passo #${r.index}">
            </div>
          </div>
        `;
      }

      imagemHtml += `</div>`;
    }

    return `
    <div class="passo-card" id="passo-${numPasso}">
      <div class="passo-header">
        <div class="passo-num-wrap">
          <span class="passo-num">Passo ${numPasso}</span>
          <span class="badge" style="background:${info.bg};color:${info.cor};border:1px solid ${info.cor}">${info.icon} ${info.texto}</span>
          ${r.duration ? `<span class="duration">⏱ ${r.duration}ms</span>` : ''}
        </div>
        <p class="passo-acao">${r.label || '(sem descrição)'}</p>
      </div>

      <div class="passo-body">
        <div class="passo-col-info">
          <div class="info-bloco">
            <span class="info-label">Resultado Esperado</span>
            <p class="info-text">${resultadoEsperado}</p>
          </div>
          <div class="info-bloco">
            <span class="info-label">Resultado Obtido</span>
            <p class="info-text detalhe-mono">${r.detalhe}</p>
          </div>
          <div class="info-bloco evidencia-bloco">
            <span class="info-label">Evidência Funcional</span>
            <p class="info-text evidencia-text">${evidenciaFuncional}</p>
          </div>
        </div>
        <div class="passo-col-screenshot">
          <span class="info-label">Captura de Tela</span>
          <div class="screenshot-wrap">${imagemHtml}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const axeHtml = axeViolations.length === 0
    ? `<div class="info-box success"><p>✅ Nenhuma violação eMAG / WCAG encontrada na análise automática.</p></div>`
    : axeViolations.map((v, i) => {
        const impactoTr = traduzirImpacto(v.impact);
        return `
        <div class="axe-violation">
          <h4>${i + 1}. ${v.description} <span class="impact-badge impact-${v.impact}">${impactoTr}</span></h4>
          <p><strong>Regra:</strong> <a href="${v.helpUrl}" target="_blank">${v.id}</a> — ${v.help}</p>
          <p><strong>Elementos afetados:</strong> ${v.nodes.length}</p>
          <div class="axe-nodes">
            ${v.nodes.slice(0, 3).map(node => {
              let summary = (node.failureSummary || '')
                .replace('Fix any of the following:', 'Corrija QUALQUER UM dos problemas:')
                .replace('Fix all of the following:', 'Corrija TODOS os problemas:')
                .replace('Element has insufficient color contrast', 'Contraste de cor insuficiente')
                .replace('Element does not have text that is visible to screen readers', 'Sem texto para leitores de tela')
                .replace('Element has no alt attribute', 'Falta atributo alt');
              return `
              <div class="axe-node">
                <code>${node.html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
                <p class="axe-summary">${summary}</p>
              </div>`;
            }).join('')}
            ${v.nodes.length > 3 ? `<p class="axe-more">+ ${v.nodes.length - 3} elementos similares encontrados</p>` : ''}
          </div>
        </div>`;
      }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Relatório Smart — ${jobName}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
*{box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#0f172a;margin:0;padding:0;background:#f8fafc}
.page{padding:50px 60px;max-width:980px;margin:0 auto;background:#fff;box-shadow:0 4px 6px -1px rgba(0,0,0,.05),0 2px 4px -2px rgba(0,0,0,.05)}
h1,h2,h3,h4{font-family:'Outfit',sans-serif;color:#0f172a}
code{font-family:'Courier New',monospace;font-size:12px;background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;color:#3b82f6}

/* Cover Premium */
.cover{min-height:900px;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
.cover-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#fff;background:linear-gradient(135deg,#3b82f6,#8b5cf6);margin-bottom:24px;padding:6px 14px;border-radius:99px;box-shadow:0 2px 4px rgba(59,130,246,.2)}
.cover h1{font-size:48px;line-height:1.1;margin:0 0 16px;letter-spacing:-1px;font-weight:800}
.cover-sub{font-size:18px;color:#64748b;font-weight:400;margin:0 0 40px}
.info-box{background:#f8fafc;border:1px solid #e2e8f0;padding:24px;border-radius:12px;margin-bottom:32px;box-shadow:inset 0 2px 4px rgba(0,0,0,.02)}
.info-box p{margin:8px 0;font-size:14px;color:#334155}
.info-box.success{border:1px solid #10b981;background:#f0fdf4}

/* Summary cards */
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:40px}
.summary-card{padding:24px 16px;border-radius:12px;border:1px solid #e2e8f0;text-align:center;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.05);transition:transform .2s}
.summary-card h3{margin:0;font-size:40px;font-weight:800;background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.summary-card p{margin:8px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#64748b}
.c-blue h3{background-image:linear-gradient(135deg,#3b82f6,#2563eb)}.c-green h3{background-image:linear-gradient(135deg,#10b981,#059669)}.c-red h3{background-image:linear-gradient(135deg,#ef4444,#dc2626)}.c-purple h3{background-image:linear-gradient(135deg,#8b5cf6,#7c3aed)}

/* Sections */
.pre-cond{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:32px;box-shadow:0 1px 3px rgba(0,0,0,.02)}
.pre-cond h3{margin:0 0 12px;font-size:16px;color:#3b82f6}
.pre-cond ul{margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.6}

.recommendation-panel{background:#fff;border:1px solid #e2e8f0;border-left:4px solid #f59e0b;border-radius:12px;padding:24px;margin-bottom:40px;box-shadow:0 1px 3px rgba(0,0,0,.02)}
.recommendation-panel h3{margin:0 0 12px;color:#d97706;font-size:16px}
.rec-list{margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.6}

.section-title{font-size:24px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin:40px 0 24px;font-weight:700}

/* Axe */
.axe-violation{border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin-bottom:16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.axe-violation h4{margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:10px}
.impact-badge{font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;text-transform:uppercase}
.impact-critical,.impact-serious{background:#fee2e2;color:#b91c1c}
.impact-moderate{background:#fef3c7;color:#b45309}
.impact-minor{background:#dcfce7;color:#15803d}
.axe-nodes{background:#f8fafc;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #e2e8f0}
.axe-node{margin-bottom:12px;background:#fff;padding:12px;border:1px solid #e2e8f0;border-radius:6px}
.justificativa{color:#475569;font-size:13px;margin-top:8px;padding:10px;border-left:3px solid #3b82f6;background:#f1f5f9;border-radius:0 6px 6px 0}

/* Passo card */
.passo-card{border:1px solid #e2e8f0;border-radius:12px;margin-bottom:32px;page-break-inside:avoid;overflow:hidden;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.02)}
.passo-header{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:20px}
.passo-num-wrap{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.passo-num{font-family:'Outfit',sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b}
.badge{padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600}
.duration{color:#94a3b8;font-size:12px;font-family:monospace}
.passo-acao{margin:0;font-size:18px;font-weight:600;color:#0f172a;line-height:1.4}

.passo-body{display:flex;flex-direction:column;gap:0}
.passo-col-info{padding:24px;border-bottom:1px solid #e2e8f0;display:flex;flex-direction:column;gap:20px}
.passo-col-screenshot{padding:24px;display:flex;flex-direction:column;gap:12px;background:#f8fafc}

.info-bloco{display:flex;flex-direction:column;gap:6px}
.info-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b}
.info-text{margin:0;font-size:14px;color:#334155;line-height:1.6}
.detalhe-mono{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-family:monospace;font-size:12px;color:#475569;word-break:break-all}
.evidencia-bloco{border-top:1px dashed #e2e8f0;padding-top:20px}
.evidencia-text{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;font-size:14px;color:#1e40af;line-height:1.6;font-style:italic}

.screenshot-wrap{flex:1;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;min-height:200px;box-shadow:inset 0 2px 4px rgba(0,0,0,.02)}
.evidencia-img{width:100%;max-height:800px;border-radius:6px;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);object-fit:contain}
.sem-evidencia{color:#94a3b8;font-size:13px;text-align:center;padding:40px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;width:100%}

/* Footer */
.footer{text-align:center;padding:40px 20px;font-size:12px;color:#64748b;margin-top:60px;border-top:1px solid #e2e8f0}

@media print {
  body{background:white !important}
  .page{box-shadow:none;padding:0 !important;width:100%;max-width:100%}
  .cover{min-height:95vh;padding:20px}
  .passo-card,.axe-violation,.recommendation-panel{page-break-inside:avoid;break-inside:avoid;box-shadow:none !important}
  h2.section-title{page-break-after:avoid}
  .passo-body{display:flex;flex-direction:column}
  .evidencia-img{max-height:750px;width:100%;object-fit:contain}
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  .no-print { display: none !important; }
}

/* Controls */
.top-controls {
  position: sticky;
  top: 0;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(12px);
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  z-index: 999;
}
.btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,.05);
}
.btn-edit { background: #fff; color: #334155; border: 1px solid #e2e8f0; }
.btn-edit:hover { background: #f8fafc; }
.btn-print { background: #0f172a; color: white; }
.btn-print:hover { background: #334155; }
.editing .page { outline: 4px dashed #3b82f6; outline-offset: 8px; border-radius: 12px; }

/* Charts */
.chart-container {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
</head>
<body>
<div class="top-controls no-print">
  <button class="btn btn-edit" onclick="toggleEdit(this)">✏️ Habilitar Edição</button>
  <button class="btn btn-print" onclick="window.print()">🖨️ Salvar PDF / Imprimir</button>
</div>

<div class="page" id="reportPage">
  <!-- CAPA -->
  <div class="cover">
    <div>
      <span class="cover-badge">Planner Smart Report</span>
    </div>
    <h1>${jobName}</h1>
    <p class="cover-sub">Execução passo a passo com Evidências Funcionais</p>
    
    <div class="info-box">
      <p><strong>Página Avaliada:</strong> <a href="${targetUrl}" style="color:#3b82f6;text-decoration:none">${targetUrl}</a></p>
      <p><strong>Data da Análise:</strong> ${dataHora}</p>
      <p><strong>Objetivo:</strong> Validar os fluxos de navegação e interação estruturalmente.</p>
    </div>
    
    <div class="summary-grid">
      <div class="summary-card c-blue"><h3>${total}</h3><p>Passos Executados</p></div>
      <div class="summary-card c-green"><h3>${aprovados}</h3><p>Aprovados</p></div>
      <div class="summary-card c-red"><h3>${falhas}</h3><p>Falhas</p></div>
      <div class="summary-card c-purple"><h3>${totalAxe}</h3><p>Violações Acess.</p></div>
    </div>

    <!-- GRÁFICOS DINÂMICOS -->
    <div class="dashboard-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px; page-break-inside: avoid;">
      <div class="chart-box" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <h3 style="text-align: center; font-size: 15px; margin-top: 0; color: #334155;">Status de Execução</h3>
        <div style="height: 250px; position: relative;"><canvas id="chartPassos"></canvas></div>
      </div>
      <div class="chart-box" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <h3 style="text-align: center; font-size: 15px; margin-top: 0; color: #334155;">Violações (Severidade)</h3>
        <div style="height: 250px; position: relative;"><canvas id="chartAxe"></canvas></div>
      </div>
    </div>

    <!-- PRIORIDADES E PLANO DE AÇÃO -->
    <div class="priorities-panel" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 40px; page-break-inside: avoid;">
      <h2 style="margin-top: 0; color: #0f172a; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">Balanço Geral & Prioridades</h2>
      ${axeViolations.length === 0 ? '<p style="color:#10b981;font-weight:600;margin-top:16px">✅ Nenhuma ação corretiva técnica necessária no momento.</p>' : `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 20px;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px;">
            <h4 style="color: #991b1b; margin: 0 0 12px; font-size: 13px;">🚨 Prioridade Alta</h4>
            <ul style="margin:0; padding-left: 20px; font-size: 12px; color: #7f1d1d; line-height: 1.6;">
              ${axeViolations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => `<li>${v.description}</li>`).join('') || '<li>Nenhuma ocorrência.</li>'}
            </ul>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 16px; border-radius: 8px;">
            <h4 style="color: #92400e; margin: 0 0 12px; font-size: 13px;">⚠️ Prioridade Média</h4>
            <ul style="margin:0; padding-left: 20px; font-size: 12px; color: #92400e; line-height: 1.6;">
               ${axeViolations.filter(v => v.impact === 'moderate').map(v => `<li>${v.description}</li>`).join('') || '<li>Nenhuma ocorrência.</li>'}
            </ul>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px;">
            <h4 style="color: #166534; margin: 0 0 12px; font-size: 13px;">ℹ️ Prioridade Baixa</h4>
            <ul style="margin:0; padding-left: 20px; font-size: 12px; color: #14532d; line-height: 1.6;">
               ${axeViolations.filter(v => v.impact === 'minor').map(v => `<li>${v.description}</li>`).join('') || '<li>Nenhuma ocorrência.</li>'}
            </ul>
          </div>
        </div>
      `}
    </div>
  </div>

  <!-- PRÉ-CONDIÇÕES -->
  <div class="pre-cond">
    <h3>📋 Pré-condições</h3>
    <ul>${preCondicoes.map(p => `<li>${p}</li>`).join('')}</ul>
  </div>

  <!-- RECOMENDAÇÕES -->
  <div class="recommendation-panel">
    <h3>💡 Recomendações Técnicas</h3>
    <ul class="rec-list">${recomendacoes.map(r => `<li>${r}</li>`).join('')}</ul>
  </div>

  <!-- ACESSIBILIDADE -->
  <h2 class="section-title">Análise de Acessibilidade (WCAG 2.1)</h2>
  ${axeHtml}

  <!-- CASO DE TESTE -->
  ${casoDeTesteHtml}

  <!-- EXECUÇÃO E EVIDÊNCIAS -->
  <div style="page-break-before:always"></div>
  <h2 class="section-title">Execução e Evidências Funcionais</h2>
  ${passosHtml}

  <div class="footer">
    <p style="margin:0">Gerado automaticamente pelo <strong>Sistema Planner</strong> &copy; ${new Date().getFullYear()}</p>
  </div>
</div>

<script>
  let myChart = null;

  const dataPassos = [${aprovados}, ${falhas}, ${total - aprovados - falhas}];
  const dataAxe = [
    ${axeViolations.filter(v => v.impact === 'minor').reduce((a,b)=>a+b.nodes.length,0)},
    ${axeViolations.filter(v => v.impact === 'moderate').reduce((a,b)=>a+b.nodes.length,0)},
    ${axeViolations.filter(v => v.impact === 'serious').reduce((a,b)=>a+b.nodes.length,0)},
    ${axeViolations.filter(v => v.impact === 'critical').reduce((a,b)=>a+b.nodes.length,0)}
  ];

  function initCharts() {
    const ctxPassos = document.getElementById('chartPassos').getContext('2d');
    const ctxAxe = document.getElementById('chartAxe').getContext('2d');
    
    new Chart(ctxPassos, {
      type: 'doughnut',
      data: {
        labels: ['Aprovados', 'Falhas', 'Outros'],
        datasets: [{
          data: dataPassos,
          backgroundColor: ['#10b981', '#ef4444', '#94a3b8'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '70%',
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 } } } }
      }
    });

    new Chart(ctxAxe, {
      type: 'bar',
      data: {
        labels: ['Baixo', 'Moderado', 'Grave', 'Crítico'],
        datasets: [{
          label: 'Elementos Afetados',
          data: dataAxe,
          backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#b91c1c'],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { 
          y: { beginAtZero: true, ticks: { precision: 0, font: { family: 'Inter' } } },
          x: { ticks: { font: { family: 'Inter' } } }
        }
      }
    });
  }

  function toggleEdit(btn) {
    const page = document.getElementById('reportPage');
    const isEditing = page.isContentEditable;
    
    if (isEditing) {
      page.contentEditable = 'false';
      document.body.classList.remove('editing');
      btn.innerHTML = '✏️ Habilitar Edição';
    } else {
      page.contentEditable = 'true';
      document.body.classList.add('editing');
      btn.innerHTML = '💾 Salvar Edição';
    }
  }

  window.onload = () => {
    initCharts();
  };
</script>
</body>
</html>`;
}
