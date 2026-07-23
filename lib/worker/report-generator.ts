// -------------------------------------------------------
// Gerador de Relatório HTML Premium → PDF
// Baseado no template do script original do usuário
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

export function buildReportHtml(opts: ReportOptions): string {
  const { results, axeViolations, targetUrl, jobName } = opts;

  const total       = results.length;
  const aprovados   = results.filter(r => r.status === 'aprovado').length;
  const falhas      = results.filter(r => ['falha_clique', 'erro_js', 'sem_texto'].includes(r.status)).length;
  const totalAxe    = axeViolations.reduce((acc, v) => acc + v.nodes.length, 0);
  const dataHora    = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // Recomendações
  const recomendacoes: string[] = [];
  if (totalAxe > 0) recomendacoes.push('<strong>Adequação eMAG:</strong> O relatório apontou violações estruturais. Aplique os ajustes para alinhar o serviço ao padrão eMAG 3.1.');
  if (falhas > 0) recomendacoes.push('<strong>Estabilidade:</strong> Eventos de clique falharam em alguns passos. Verifique bloqueios por popups/overlays ou seletores desatualizados.');
  if (recomendacoes.length === 0) recomendacoes.push('<strong>Conformidade Plena:</strong> Fluxo validado com sucesso e aderente às cartilhas recomendadas.');

  // Filtrar passos realmente relevantes para exibição no relatório principal
  // (Passos de 'wait' ou 'scroll' aprovados não precisam virar cards individuais gigantes com prints idênticas)
  const relevantesResults = results.filter(r => {
    if (r.status !== 'aprovado') return true; // Falhas SEMPRE aparecem
    const labelLower = (r.label || '').toLowerCase();
    if (labelLower.includes('aguardar') && !labelLower.includes('navegação')) return false;
    return true;
  });

  const cardsHtml = (relevantesResults.length > 0 ? relevantesResults : results).map(r => {
    const info = getStatusInfo(r.status as StatusBotao);
    const imagemHtml = r.screenshotBase64
      ? `<img src="data:image/jpeg;base64,${r.screenshotBase64}" class="evidencia-img" alt="Evidência Passo #${r.index}">`
      : `<div class="sem-evidencia">Sem Evidência Capturada</div>`;

    return `
      <div class="result-card">
        <div class="result-header">
          <span class="badge" style="background-color:${info.bg};color:${info.cor};border:1px solid ${info.cor};">
            ${info.icon} ${info.texto}
          </span>
          <span class="index">Passo #${r.index}</span>
        </div>
        <div class="result-body">
          <div class="result-evidencia">${imagemHtml}</div>
          <div class="result-details">
            <p class="label-title">Ação Realizada</p>
            <p class="text-content">${r.label || '<em>(Sem descrição)</em>'}</p>
            <p class="label-title mt">Resultado da Execução</p>
            <p class="detail-content">${r.detalhe}</p>
            ${r.duration ? `<p class="duration">⏱ ${r.duration}ms</p>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const axeHtml = axeViolations.length === 0
    ? `<div class="info-box success"><p>✅ Excelente! Nenhuma violação eMAG / WCAG encontrada.</p></div>`
    : axeViolations.map((v, i) => {
        const impactoTr = traduzirImpacto(v.impact);
        return `
        <div class="axe-violation">
          <h4>${i + 1}. ${v.description} (Impacto: ${impactoTr})</h4>
          <p><strong>Regra:</strong> <a href="${v.helpUrl}" target="_blank">${v.id}</a> — ${v.help}</p>
          <p><strong>Elementos afetados:</strong> ${v.nodes.length}</p>
          <div class="axe-nodes">
            ${v.nodes.slice(0, 3).map(node => {
              let summary = (node.failureSummary || '')
                .replace('Fix any of the following:', 'Corrija QUALQUER UM dos problemas:')
                .replace('Fix all of the following:', 'Corrija TODOS os problemas:')
                .replace('Element has insufficient color contrast', 'Contraste de cor insuficiente')
                .replace('Element does not have text that is visible to screen readers', 'Elemento sem texto para leitores de tela')
                .replace('Element has no alt attribute', 'Falta atributo alt');
              return `
              <div style="margin-bottom:12px;background:#fff;padding:10px;border:1px solid #e5e7eb;border-radius:6px;">
                <code>${node.html.replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 180)}...</code>
                <div class="justificativa"><strong>Justificativa eMAG:</strong><br>${summary.replace(/\n/g, '<br>')}</div>
              </div>`;
            }).join('')}
            ${v.nodes.length > 3 ? `<em>...e mais ${v.nodes.length - 3} ocultados.</em>` : ''}
          </div>
        </div>`;
      }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Auditoria eMAG — ${jobName}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#334155;margin:0;padding:0;background:#f1f5f9}
.page{padding:50px 60px;max-width:960px;margin:0 auto;background:#fff;box-shadow:0 4px 6px -1px rgba(0,0,0,.1)}
h1,h2,h3,h4{font-family:'Outfit',sans-serif;color:#0f172a}
.cover{min-height:1040px;display:flex;flex-direction:column;justify-content:center;page-break-after:always}
.cover-logo{font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#3b82f6;margin-bottom:20px;display:inline-block;border-bottom:2px solid #3b82f6;padding-bottom:5px}
.cover h1{font-size:52px;line-height:1.1;margin:0 0 12px;letter-spacing:-1.5px}
.cover h2{font-size:22px;color:#64748b;font-weight:400;margin:0 0 40px}
.info-box{background:#f8fafc;border-left:4px solid #3b82f6;padding:24px;border-radius:8px;margin-bottom:40px}
.info-box p{margin:8px 0;font-size:15px}
.info-box.success{border-left-color:#10b981;background:#ecfdf5}
.summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
.summary-card{padding:28px 20px;border-radius:16px;border:1px solid #e2e8f0;text-align:center}
.summary-card h3{margin:0;font-size:44px;font-weight:700}
.summary-card p{margin:10px 0 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#64748b}
.c-blue h3{color:#2563eb}.c-green h3{color:#059669}.c-red h3{color:#e11d48}.c-purple h3{color:#7c3aed}
.recommendation-panel{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:28px;margin-bottom:40px}
.recommendation-panel h3{margin:0 0 16px;color:#b45309;font-size:20px}
.rec-list{margin:0;padding-left:18px;color:#92400e;font-size:14px;line-height:1.7}
.section-title{font-size:26px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:12px;margin:40px 0 24px}
.axe-violation{border:1px solid #e2e8f0;border-left:5px solid #e11d48;padding:20px;border-radius:12px;margin-bottom:20px}
.axe-violation h4{margin:0 0 10px;font-size:16px}
.axe-nodes{background:#f8fafc;padding:14px;border-radius:8px;margin-top:14px}
.justificativa{color:#b45309;font-size:13px;margin-top:8px;padding:10px 12px;border-left:3px solid #fbbf24;background:#fef3c7}
.results-container{display:flex;flex-direction:column;gap:20px}
.result-card{border:1px solid #e2e8f0;border-radius:12px;page-break-inside:avoid}
.result-header{background:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.badge{padding:5px 11px;border-radius:24px;font-size:12px;font-weight:600}
.index{color:#94a3b8;font-weight:600;font-size:13px}
.result-body{display:flex;flex-direction:column;padding:20px;gap:20px}
.result-evidencia{width:100%;display:flex;justify-content:center;align-items:center;background:#f8fafc;border:1px dashed #cbd5e1;padding:12px;flex-shrink:0}
.evidencia-img{max-width:100%;max-height:550px;border-radius:6px;box-shadow:0 4px 6px -1px rgba(0,0,0,.15);object-fit:contain}
.sem-evidencia{color:#94a3b8;font-size:12px}
.result-details{flex:1}
.label-title{font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;margin:0 0 5px}
.mt{margin-top:16px}
.text-content{margin:0;font-size:15px;font-weight:500;color:#0f172a;line-height:1.4}
.detail-content{margin:0;font-size:12px;background:#f1f5f9;padding:8px 12px;border-radius:6px;border:1px solid #e2e8f0;font-family:monospace}
.duration{margin:8px 0 0;font-size:11px;color:#94a3b8}
.footer{text-align:center;padding:36px;font-size:12px;color:#94a3b8;margin-top:50px;border-top:1px solid #e2e8f0}

@media print {
  body { background: white !important; font-size: 14px; }
  .page { box-shadow: none; padding: 0 !important; width: 100%; max-width: 100%; }
  .cover { min-height: 95vh; padding: 20px; }
  .result-card, .axe-violation, .recommendation-panel { 
    page-break-inside: avoid; 
    break-inside: avoid;
    box-shadow: none !important;
  }
  h2.section-title { page-break-after: avoid; }
  .result-evidencia { width: 100%; max-width: 100%; background: white !important; }
  .evidencia-img { max-height: 650px; }
  .result-body { flex-direction: column; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
</style>
</head>
<body>
<div class="page">
  <div class="cover">
    <span class="cover-logo">Auditoria de Qualidade Web</span>
    <h1>${jobName}</h1>
    <h2>Relatório automatizado baseado na cartilha eMAG 3.1 e WCAG 2.1 AA</h2>
    <div class="info-box">
      <p><strong>Página Avaliada:</strong> <a href="${targetUrl}" style="color:#2563eb">${targetUrl}</a></p>
      <p><strong>Data da Análise:</strong> ${dataHora}</p>
    </div>
    <div class="summary-grid">
      <div class="summary-card c-blue"><h3>${total}</h3><p>Ações de Teste</p></div>
      <div class="summary-card c-green"><h3>${aprovados}</h3><p>Aprovados</p></div>
      <div class="summary-card c-red"><h3>${falhas}</h3><p>Falhas de Ação</p></div>
      <div class="summary-card c-purple"><h3>${totalAxe}</h3><p>Violações eMAG</p></div>
    </div>
  </div>

  <div class="recommendation-panel">
    <h3>💡 Recomendações eMAG</h3>
    <ul class="rec-list">${recomendacoes.map(r => `<li>${r}</li>`).join('')}</ul>
  </div>

  <h2 class="section-title">Análise de Acessibilidade (eMAG / WCAG)</h2>
  ${axeHtml}

  <div style="page-break-before:always"></div>
  <h2 class="section-title">Execução do Script do Usuário</h2>
  <div class="results-container">${cardsHtml}</div>

  <div class="footer">Gerado automaticamente pelo Sistema de QA Automatizado &copy; ${new Date().getFullYear()}</div>
</div>
</body>
</html>`;
}
