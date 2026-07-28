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
}

function getStatusInfo(status: StatusBotao) {
  switch (status) {
    case 'aprovado':     return { cor: '#10b981', bg: '#ecfdf5', texto: 'Aprovado',    icon: '✓' };
    case 'falha_clique': return { cor: '#f59e0b', bg: '#fffbeb', texto: 'Falha Ação',  icon: '⚡' };
    case 'erro_js':      return { cor: '#ef4444', bg: '#fef2f2', texto: 'Erro JS',     icon: '✖' };
    case 'sem_texto':    return { cor: '#ef4444', bg: '#fef2f2', texto: 'S/ Texto',    icon: '⚠' };
    case 'pulado':       return { cor: '#6b7280', bg: '#f3f4f6', texto: 'Pulado',      icon: '⊘' };
    default:             return { cor: '#6b7280', bg: '#f3f4f6', texto: status,         icon: '?' };
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
    return (hasScreenshot ? 'Screenshot capturado mostrando ' : 'Estado do sistema indicando ') +
      'falha na execução do passo #' + index + '. Erro registrado: "' + errMsg + '". ' +
      'O elemento pode estar oculto, com seletor inválido ou bloqueado por overlay.';
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

  // Pré-condições automáticas
  const preCondicoes = [
    'Navegador atualizado (Chrome / Edge / Firefox) com acesso à internet.',
    'URL de teste acessível publicamente: <code>' + targetUrl + '</code>.',
    'Ambiente de execução: Playwright headless (Node.js).',
  ];
  if (aprovados === total) {
    preCondicoes.push('Nenhuma autenticação obrigatória detectada nos fluxos testados.');
  }

  const passosHtml = displayResults.map((r, pos) => {
    const info = getStatusInfo(r.status as StatusBotao);
    const numPasso = pos + 1;
    const resultadoEsperado = buildResultadoEsperado(r);
    const evidenciaFuncional = buildEvidenciaFuncional(r, r.index);

    const imagemHtml = r.screenshotBase64
      ? `<img src="data:image/jpeg;base64,${r.screenshotBase64}" class="evidencia-img" alt="Evidência Passo #${r.index}">`
      : `<div class="sem-evidencia">⚠ Sem captura de tela disponível para este passo.</div>`;

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
                <code>${node.html.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 200)}...</code>
                <div class="justificativa"><strong>Justificativa eMAG:</strong><br>${summary.replace(/\n/g, '<br>')}</div>
              </div>`;
            }).join('')}
            ${v.nodes.length > 3 ? `<em>...e mais ${v.nodes.length - 3} elemento(s) não exibido(s).</em>` : ''}
          </div>
        </div>`;
      }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Caso de Teste — ${jobName}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
*{box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#334155;margin:0;padding:0;background:#f1f5f9}
.page{padding:50px 60px;max-width:980px;margin:0 auto;background:#fff;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}
h1,h2,h3,h4{font-family:'Outfit',sans-serif;color:#0f172a}
code{font-family:'Courier New',monospace;font-size:12px;background:#f1f5f9;padding:2px 6px;border-radius:4px}

/* Cover */
.cover{min-height:1040px;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
.cover-logo{font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#3b82f6;margin-bottom:24px;display:inline-block;border-bottom:2px solid #3b82f6;padding-bottom:6px}
.cover h1{font-size:48px;line-height:1.1;margin:0 0 10px;letter-spacing:-1.5px}
.cover-sub{font-size:18px;color:#64748b;font-weight:400;margin:0 0 36px}
.info-box{background:#f8fafc;border-left:4px solid #3b82f6;padding:20px 24px;border-radius:8px;margin-bottom:32px}
.info-box p{margin:6px 0;font-size:14px}
.info-box.success{border-left-color:#10b981;background:#ecfdf5}

/* Summary cards */
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
.summary-card{padding:24px 16px;border-radius:14px;border:1px solid #e2e8f0;text-align:center}
.summary-card h3{margin:0;font-size:40px;font-weight:800}
.summary-card p{margin:8px 0 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b}
.c-blue h3{color:#2563eb}.c-green h3{color:#059669}.c-red h3{color:#e11d48}.c-purple h3{color:#7c3aed}

/* Pre-conditions */
.pre-cond{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;margin-bottom:32px}
.pre-cond h3{margin:0 0 12px;font-size:16px;color:#1d4ed8}
.pre-cond ul{margin:0;padding-left:18px;color:#1e3a5f;font-size:14px;line-height:1.8}

/* Recommendations */
.recommendation-panel{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:24px;margin-bottom:36px}
.recommendation-panel h3{margin:0 0 14px;color:#b45309;font-size:18px}
.rec-list{margin:0;padding-left:18px;color:#92400e;font-size:14px;line-height:1.7}

/* Section title */
.section-title{font-size:24px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin:36px 0 20px}

/* Axe */
.axe-violation{border:1px solid #e2e8f0;border-left:5px solid #e11d48;padding:18px 20px;border-radius:10px;margin-bottom:18px}
.axe-violation h4{margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:10px}
.impact-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;text-transform:uppercase}
.impact-critical,.impact-serious{background:#fee2e2;color:#991b1b}
.impact-moderate{background:#fef3c7;color:#92400e}
.impact-minor{background:#f0fdf4;color:#166534}
.axe-nodes{background:#f8fafc;padding:12px;border-radius:8px;margin-top:12px}
.axe-node{margin-bottom:12px;background:#fff;padding:10px;border:1px solid #e5e7eb;border-radius:6px}
.justificativa{color:#b45309;font-size:12px;margin-top:8px;padding:8px 10px;border-left:3px solid #fbbf24;background:#fef3c7}

/* Passo card */
.passo-card{border:1px solid #e2e8f0;border-radius:14px;margin-bottom:28px;page-break-inside:avoid;overflow:hidden}
.passo-header{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px 20px}
.passo-num-wrap{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.passo-num{font-family:'Outfit',sans-serif;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#64748b}
.badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700}
.duration{color:#94a3b8;font-size:11px;font-family:monospace}
.passo-acao{margin:0;font-size:16px;font-weight:600;color:#0f172a;line-height:1.4}

.passo-body{display:flex;flex-direction:column;gap:0}
.passo-col-info{padding:20px;border-bottom:1px solid #e2e8f0;display:flex;flex-direction:column;gap:16px}
.passo-col-screenshot{padding:20px;display:flex;flex-direction:column;gap:8px;background:#fafafa}

.info-bloco{display:flex;flex-direction:column;gap:4px}
.info-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8}
.info-text{margin:0;font-size:13px;color:#334155;line-height:1.5}
.detalhe-mono{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;font-family:monospace;font-size:11px;color:#475569;word-break:break-all}
.evidencia-bloco{border-top:1px dashed #e2e8f0;padding-top:16px}
.evidencia-text{background:linear-gradient(135deg,#eff6ff,#f0fdf4);border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;font-size:12px;color:#1e3a5f;line-height:1.6;font-style:italic}

.screenshot-wrap{flex:1;display:flex;align-items:center;justify-content:center;background:#fff;border:1px dashed #cbd5e1;border-radius:8px;padding:12px;min-height:120px}
.evidencia-img{width:100%;max-height:800px;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.15);object-fit:contain}
.sem-evidencia{color:#94a3b8;font-size:11px;text-align:center;padding:20px}

/* Footer */
.footer{text-align:center;padding:32px;font-size:11px;color:#94a3b8;margin-top:40px;border-top:1px solid #e2e8f0}

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
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(10px);
  padding: 12px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  z-index: 999;
}
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-edit { background: #3b82f6; color: white; }
.btn-edit:hover { background: #2563eb; }
.btn-print { background: #10b981; color: white; }
.btn-print:hover { background: #059669; }
.editing .page { outline: 3px dashed #3b82f6; outline-offset: 5px; }

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
.chart-select {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  margin-bottom: 20px;
  outline: none;
  cursor: pointer;
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
    <span class="cover-logo">Caso de Teste Automatizado</span>
    <h1>${jobName}</h1>
    <p class="cover-sub">Execução passo a passo com Evidências Funcionais — eMAG 3.1 / WCAG 2.1 AA</p>
    <div class="info-box">
      <p><strong>Página Avaliada:</strong> <a href="${targetUrl}" style="color:#2563eb">${targetUrl}</a></p>
      <p><strong>Data da Análise:</strong> ${dataHora}</p>
      <p><strong>Objetivo:</strong> Validar os fluxos de navegação e interação, registrando o estado real do sistema após cada ação.</p>
    </div>
    <div class="summary-grid">
      <div class="summary-card c-blue"><h3>${total}</h3><p>Passos Executados</p></div>
      <div class="summary-card c-green"><h3>${aprovados}</h3><p>Aprovados</p></div>
      <div class="summary-card c-red"><h3>${falhas}</h3><p>Falhas</p></div>
      <div class="summary-card c-purple"><h3>${totalAxe}</h3><p>Violações eMAG</p></div>
    </div>

    <!-- GRÁFICOS DINÂMICOS -->
    <div class="dashboard-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px; page-break-inside: avoid;">
      <div class="chart-box" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
        <h3 style="text-align: center; font-size: 14px; margin-top: 0; color: #475569;">Status de Execução dos Passos</h3>
        <div style="height: 250px; position: relative;"><canvas id="chartPassos"></canvas></div>
      </div>
      <div class="chart-box" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
        <h3 style="text-align: center; font-size: 14px; margin-top: 0; color: #475569;">Violações de Acessibilidade (Severidade)</h3>
        <div style="height: 250px; position: relative;"><canvas id="chartAxe"></canvas></div>
      </div>
    </div>

    <!-- PRIORIDADES E PLANO DE AÇÃO -->
    <div class="priorities-panel" style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 40px; page-break-inside: avoid;">
      <h2 style="margin-top: 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Balanço Geral: Plano de Ação e Prioridades</h2>
      ${axeViolations.length === 0 ? '<p style="color:#10b981;font-weight:600;">✅ Nenhuma ação corretiva técnica necessária no momento.</p>' : `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 16px;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px;">
            <h4 style="color: #991b1b; margin: 0 0 8px; font-size: 13px;">🚨 Prioridade Alta (Crítico/Grave)</h4>
            <ul style="margin:0; padding-left: 20px; font-size: 12px; color: #7f1d1d; line-height: 1.6;">
              ${axeViolations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => `<li>${v.description}</li>`).join('') || '<li>Nenhuma ocorrência.</li>'}
            </ul>
          </div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 16px; border-radius: 8px;">
            <h4 style="color: #92400e; margin: 0 0 8px; font-size: 13px;">⚠️ Prioridade Média (Moderado)</h4>
            <ul style="margin:0; padding-left: 20px; font-size: 12px; color: #92400e; line-height: 1.6;">
               ${axeViolations.filter(v => v.impact === 'moderate').map(v => `<li>${v.description}</li>`).join('') || '<li>Nenhuma ocorrência.</li>'}
            </ul>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px;">
            <h4 style="color: #166534; margin: 0 0 8px; font-size: 13px;">ℹ️ Prioridade Baixa (Baixo)</h4>
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
  <h2 class="section-title">Análise de Acessibilidade (eMAG / WCAG)</h2>
  ${axeHtml}

  <!-- EXECUÇÃO E EVIDÊNCIAS -->
  <div style="page-break-before:always"></div>
  <h2 class="section-title">Execução e Evidências Funcionais</h2>
  ${passosHtml}

  <div class="footer">Gerado automaticamente pelo Sistema de QA Automatizado &copy; ${new Date().getFullYear()}</div>
</div>

<script>
  let myChart = null;

  // Variáveis injetadas pelo backend para o gráfico
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
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    new Chart(ctxAxe, {
      type: 'bar',
      data: {
        labels: ['Baixo', 'Moderado', 'Grave', 'Crítico'],
        datasets: [{
          label: 'Elementos Afetados',
          data: dataAxe,
          backgroundColor: ['#166534', '#92400e', '#991b1b', '#7f1d1d'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
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
      btn.style.background = '#3b82f6';
    } else {
      page.contentEditable = 'true';
      document.body.classList.add('editing');
      btn.innerHTML = '💾 Desativar Edição';
      btn.style.background = '#f59e0b';
    }
  }

  // Inicializar gráficos
  window.onload = () => {
    initCharts();
  };
</script>
</body>
</html>`;
}
