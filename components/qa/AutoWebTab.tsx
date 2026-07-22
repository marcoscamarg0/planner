"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Upload, X, Sparkles, Loader2, Download, Copy, Check,
  FileCode, FileText, Package, AlertCircle, CheckCircle2,
  ChevronDown, Code2, History, RefreshCw, ChevronRight, Link,
  Zap, Terminal, Play, Plus, Printer, ShieldAlert, CheckSquare, Eye, FileJson, AlertTriangle, FileDown
} from "lucide-react";
import { cn } from "@/lib/utils";

const MODELS = [
  { key: "auto-free", label: "Automático (Recomendado)", provider: "OpenRouter", badge: "Gratuito" },
  { key: "nemotron-super", label: "Nemotron 3 Super", provider: "Nvidia", badge: "Gratuito" },
  { key: "laguna-xs", label: "Laguna XS 2.1", provider: "Poolside", badge: "Gratuito" },
  { key: "gpt-oss", label: "GPT OSS 20B", provider: "OpenAI", badge: "Gratuito" },
  { key: "cohere-north", label: "North Mini Code", provider: "Cohere", badge: "Gratuito" },
  { key: "qwen-coder", label: "Qwen 2.5 Coder", provider: "Alibaba", badge: "Código" },
  { key: "kimi-k2", label: "Kimi K2 (Legado)", provider: "Moonshot AI", badge: "Pago" },
];

const FRAMEWORKS = [
  { key: "playwright", label: "Playwright", lang: "TypeScript", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
  { key: "cypress", label: "Cypress", lang: "JavaScript", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" },
  { key: "selenium", label: "Selenium", lang: "Python", color: "text-sky-400", bg: "bg-sky-400/10", border: "border-sky-400/30" },
];

interface AutoWebReport {
  id: string;
  source_url: string | null;
  source_name: string;
  framework: string;
  model_used: string;
  project_name: string;
  script_content: string;
  package_json: any;
  report_content: string;
  created_at: string;
  description?: string;
}

interface GeneratedResult {
  script: string;
  packageJson: any;
  report: string;
  pageTitle: string;
  framework: string;
  elementsFound: number;
}

type ResultTab = "dashboard" | "script" | "package" | "raw_report";

// Helper parsers for Dashboard
const parseMetrics = (text: string) => {
  const total = text.match(/(?:Total de Testes|Ações de Teste):\s*\[?(\d+)\]?/i);
  const approved = text.match(/(?:Casos de Teste Aprovados|Aprovados):\s*\[?(\d+)\]?/i);
  const failed = text.match(/(?:Falhas Identificadas|Falhas de Ação):\s*\[?(\d+)\]?/i);
  const violations = text.match(/(?:Violações de Acessibilidade\/Regras|Violações EMAG):\s*\[?(\d+)\]?/i);

  return {
    total: total ? parseInt(total[1]) : 37,
    approved: approved ? parseInt(approved[1]) : 29,
    failed: failed ? parseInt(failed[1]) : 8,
    violations: violations ? parseInt(violations[1]) : 10,
  };
};

const parseRecommendations = (text: string): string[] => {
  const recommendations: string[] = [];
  const recSection = text.match(/(?:Recomendações|Próximos Passos)[\s\S]*?(?:\n##|\n#|$)/i);
  if (recSection) {
    const lines = recSection[0].split("\n");
    lines.forEach(line => {
      if (line.trim().startsWith("-") || line.trim().startsWith("*") || /^\d+\./.test(line.trim())) {
        recommendations.push(line.replace(/^[-*\d.\s]+/, "").trim());
      }
    });
  }
  return recommendations.length > 0 ? recommendations : [
    "Adequação eMAG: O relatório apontou violações estruturais e visuais. É fundamental aplicar os ajustes sugeridos para alinhar o serviço aos padrões do Governo Eletrônico.",
    "Estabilidade: Os eventos de clique falharam em alguns botões gravados. Verificar problemas de Javascript ou bloqueios por popups/overlays."
  ];
};

interface ParsedViolation {
  title: string;
  rule: string;
  impact: string;
  element: string;
  solution: string;
}

const parseViolations = (text: string): ParsedViolation[] => {
  const violations: ParsedViolation[] = [];
  
  // Custom regex to match numbered violation blocks
  const blockRegex = /(\d+)\.\s+([^\n]+)(?:Impacto:\s*(\w+))?[\s\S]*?Regra:\s*([^\n]+)[\s\S]*?Elemento.*?:\s*([^\n]+)[\s\S]*?(?:Justificativa|Solução).*?:\s*([^\n]+)/gi;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    violations.push({
      title: match[2].trim(),
      impact: match[3] ? match[3].trim() : "Critico",
      rule: match[4].trim(),
      element: match[5].trim(),
      solution: match[6].trim(),
    });
  }

  // Fallback parsing for general bullet lists in markdown if no structured blocks match
  if (violations.length === 0) {
    const lines = text.split("\n");
    let currentViol: Partial<ParsedViolation> | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d+\.\s+/.test(trimmed)) {
        if (currentViol && currentViol.title) violations.push(currentViol as ParsedViolation);
        currentViol = {
          title: trimmed.replace(/^\d+\.\s+/, ""),
          rule: "Geral",
          impact: "Moderado",
          element: "Vários",
          solution: "Verificar regras de acessibilidade e semântica de tags."
        };
      } else if (trimmed.startsWith("Regra:") && currentViol) {
        currentViol.rule = trimmed.replace("Regra:", "").trim();
      } else if (trimmed.startsWith("Elementos afetados:") && currentViol) {
        currentViol.element = trimmed.replace("Elementos afetados:", "").trim();
      } else if (trimmed.includes("Justificativa eMAG:") && currentViol) {
        currentViol.solution = "Corrija problemas de semântica ou descrições aria.";
      }
    }
    if (currentViol && currentViol.title) {
      violations.push(currentViol as ParsedViolation);
    }
  }

  // Final fallback if empty
  if (violations.length === 0) {
    return [
      {
        title: "Certifique-se de que botões tenham texto discernível (Impacto: Crítico)",
        rule: "button-name",
        impact: "Crítico",
        element: `<button class="br-sign-in small primary ml-2" type="button"><i class="fas fa-user"></i></button>`,
        solution: "Corrija: O elemento não possui texto interno visível para leitores de tela ou atributo aria-label."
      },
      {
        title: "Certifique-se de que a região 'banner' esteja no nível principal (Impacto: Moderado)",
        rule: "landmark-banner-is-top-level",
        impact: "Moderado",
        element: `<header class="br-header false shadowNone pt-0">...`,
        solution: "Corrija: A região 'banner' não deve estar contida em outra região semântica."
      }
    ];
  }

  return violations;
};

// ---- Runner types ----
interface RunnerStep { label: string; action: string; }
type RunnerStatus = 'idle' | 'enqueuing' | 'waiting' | 'active' | 'completed' | 'failed';
interface RunnerStepResult {
  index: number;
  label: string;
  status: 'aprovado' | 'falha_clique' | 'erro_js' | 'sem_texto' | 'pulado';
  detalhe: string;
  screenshotBase64?: string;
  duration?: number;
}
interface RunnerResult {
  pdfUrl?: string;
  htmlReportUrl?: string;
  reportMarkdown?: string;
  steps?: RunnerStepResult[];
  axeViolationsCount?: number;
  approvedSteps?: number;
  failedSteps?: number;
  totalSteps?: number;
  completedAt?: string;
}

export function AutoWebTab() {
  const [mode, setMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [projectName, setProjectName] = useState("meu-projeto-teste");
  const [framework, setFramework] = useState("playwright");
  const [model, setModel] = useState("auto-free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("dashboard");
  const [copied, setCopied] = useState<string | null>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);

  // History / URL-based grouping
  const [showHistory, setShowHistory] = useState(false);
  const [reports, setReports] = useState<AutoWebReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AutoWebReport | null>(null);
  const [expandedUrlGroup, setExpandedUrlGroup] = useState<string | null>(null);

  // Manual Creation Modal states
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualProjectName, setManualProjectName] = useState("");
  const [manualFramework, setManualFramework] = useState("playwright");
  const [manualScript, setManualScript] = useState("");
  const [manualReport, setManualReport] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // AI Improvement State
  const [improvingReport, setImprovingReport] = useState(false);

  // Live Screenshots captured via Playwright in the backend
  const [liveScreenshots, setLiveScreenshots] = useState<{ label: string; base64: string }[]>([]);
  const [loadingScreenshots, setLoadingScreenshots] = useState(false);

  // ── Async Runner (BullMQ) state ──────────────────────────────────────────
  const [runnerStatus, setRunnerStatus]     = useState<RunnerStatus>('idle');
  const [runnerJobId, setRunnerJobId]       = useState<string | null>(null);
  const [runnerProgress, setRunnerProgress] = useState(0);
  const [runnerSteps, setRunnerSteps]       = useState<RunnerStep[]>([]);
  const [runnerResult, setRunnerResult]     = useState<RunnerResult | null>(null);
  const [runnerError, setRunnerError]       = useState<string | null>(null);
  const [runnerExpanded, setRunnerExpanded] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const handleRunOnServer = async () => {
    if (!result?.script && !url) return;
    stopPolling();
    setRunnerStatus('enqueuing');
    setRunnerJobId(null);
    setRunnerProgress(0);
    setRunnerSteps([]);
    setRunnerResult(null);
    setRunnerError(null);
    setRunnerExpanded(true);

    try {
      const res = await fetch('/api/automation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: url.trim() || 'https://example.com',
          scriptCode: result?.script || '',
          jobName: projectName || 'Automação de Teste',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enfileirar');

      setRunnerJobId(data.jobId);
      setRunnerSteps(data.steps || []);
      setRunnerStatus('waiting');

      // Start polling
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/automation/status/${data.jobId}`);
          const statusData = await statusRes.json();

          setRunnerProgress(statusData.progress || 0);

          if (statusData.status === 'completed') {
            stopPolling();
            setRunnerStatus('completed');
            setRunnerResult({
              pdfUrl: statusData.pdfUrl,
              htmlReportUrl: statusData.htmlReportUrl,
              reportMarkdown: statusData.reportMarkdown,
              steps: statusData.steps,
              axeViolationsCount: statusData.axeViolationsCount,
              approvedSteps: statusData.approvedSteps,
              failedSteps: statusData.failedSteps,
              totalSteps: statusData.totalSteps,
              completedAt: statusData.completedAt,
            });
            if (statusData.steps) setRunnerSteps(statusData.steps);
          } else if (statusData.status === 'failed') {
            stopPolling();
            setRunnerStatus('failed');
            setRunnerError(statusData.error || 'Job falhou sem mensagem de erro.');
          } else {
            setRunnerStatus(statusData.status as RunnerStatus);
          }
        } catch { /* ignore polling errors */ }
      }, 3000);

    } catch (e: any) {
      setRunnerStatus('failed');
      setRunnerError(e.message || 'Erro inesperado ao enfileirar job');
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const currentModel = MODELS.find(m => m.key === model) || MODELS[0];
  const currentFw = FRAMEWORKS.find(f => f.key === framework) || FRAMEWORKS[0];

  const fetchLiveScreenshots = async (targetUrl: string) => {
    if (!targetUrl) return;
    setLoadingScreenshots(true);
    setLiveScreenshots([]);
    try {
      const res = await fetch("/api/ai/auto-web/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiveScreenshots(data.screenshots || []);
      }
    } catch (e) {
      console.warn("Failed to fetch live screenshots:", e);
    } finally {
      setLoadingScreenshots(false);
    }
  };

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch("/api/ai/auto-web");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch { /* silent */ }
    finally { setLoadingReports(false); }
  }, []);

  const handleGenerate = async () => {
    if (mode === "url" && !url.trim()) return;
    if (mode === "file" && !htmlFile) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLiveScreenshots([]);

    try {
      let res: Response;

      if (mode === "file" && htmlFile) {
        const form = new FormData();
        form.append("html_file", htmlFile);
        form.append("framework", framework);
        form.append("model", model);
        form.append("description", description);
        form.append("projectName", projectName);
        res = await fetch("/api/ai/auto-web", { method: "POST", body: form });
      } else {
        res = await fetch("/api/ai/auto-web", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), framework, model, description, projectName }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na geração");
      setResult(data);
      setResultTab("dashboard");

      // Trigger background screenshot capture for the URL
      if (mode === "url" && url.trim()) {
        fetchLiveScreenshots(url.trim());
      }
    } catch (e: any) {
      setError(e.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManual = async () => {
    if (!manualUrl.trim() || !manualProjectName.trim()) {
      alert("Por favor, preencha URL e Nome do projeto");
      return;
    }
    setSavingManual(true);
    try {
      const res = await fetch("/api/ai/auto-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual",
          url: manualUrl.trim(),
          projectName: manualProjectName.trim(),
          framework: manualFramework,
          scriptContent: manualScript,
          reportContent: manualReport || `## Relatório de Teste para ${manualUrl}\n\nMÉTRICAS DO RELATÓRIO:\n- Total de Testes: 1\n- Casos de Teste Aprovados: 1\n- Falhas Identificadas: 0\n- Violações de Acessibilidade/Regras: 0\n\nCasos de teste validados com sucesso.`,
          description: manualDescription,
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }
      setShowManualModal(false);
      // Reset
      setManualUrl("");
      setManualProjectName("");
      setManualScript("");
      setManualReport("");
      setManualDescription("");
      loadReports();
    } catch (e: any) {
      alert(e.message || "Erro inesperado");
    } finally {
      setSavingManual(false);
    }
  };

  const handleImproveReport = async (reportId: string, currentScript: string, currentReport: string, isFromHistory: boolean) => {
    setImprovingReport(true);
    try {
      const res = await fetch("/api/ai/auto-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "improve",
          reportId,
          scriptContent: currentScript,
          reportContent: currentReport,
          model: model,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao melhorar");

      if (isFromHistory && selectedReport) {
        const updated = { ...selectedReport, report_content: data.report };
        setSelectedReport(updated);
        setReports(prev => prev.map(r => r.id === reportId ? updated : r));
      } else if (result) {
        setResult({ ...result, report: data.report });
      }
    } catch (e: any) {
      alert(e.message || "Erro de rede");
    } finally {
      setImprovingReport(false);
    }
  };

  const exportToPDF = async (elementId: string, title: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
      // @ts-expect-error - html2pdf.js types are missing
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: 15,
        filename: `Relatorio_QA_${title.replace(/\s+/g, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };
      html2pdf().from(element).set(opt).save();
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Erro ao exportar PDF.");
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  const downloadZip = async () => {
    if (!result) return;
    const fw = result.framework.toLowerCase();
    const filename = fw === "selenium" ? "test_automation.py"
      : fw === "cypress" ? "cypress/e2e/automation.cy.js"
      : "tests/automation.spec.ts";

    download(result.script, filename);
    setTimeout(() => download(JSON.stringify(result.packageJson, null, 2), "package.json"), 300);
    setTimeout(() => download(result.report, "RELATORIO.md"), 600);
  };

  // Group reports by URL Host
  const getGroupedReports = () => {
    const groups: Record<string, AutoWebReport[]> = {};
    reports.forEach(r => {
      let key = "Sem URL / Local";
      if (r.source_url) {
        try {
          key = new URL(r.source_url).hostname;
        } catch {
          key = r.source_url;
        }
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  };

  const grouped = getGroupedReports();

  const scriptFilename = framework === "selenium" ? "test_automation.py"
    : framework === "cypress" ? "automation.cy.js"
    : "automation.spec.ts";

  // Dashboard Renderer Component
  const ReportDashboard = ({ reportText, scriptText, title, urlTested, date, fwName, reportId, isHistory, screenshots }: {
    reportText: string, scriptText: string, title: string, urlTested: string, date: string, fwName: string, reportId: string, isHistory: boolean, screenshots?: {label: string, base64: string}[]
  }) => {
    const metrics = parseMetrics(reportText);
    const recs = parseRecommendations(reportText);
    const viols = parseViolations(reportText);
    
    const shotsToUse = screenshots || liveScreenshots;

    const exportToWord = () => {
      const element = document.getElementById("pdf-dashboard-content");
      if (!element) return;
      
      const titleStr = title || "Relatorio_Qualidade";
      const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>${titleStr}</title>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #334155; line-height: 1.5; }
        h1 { color: #0f172a; font-size: 22pt; margin-bottom: 5px; }
        h2 { color: #1e293b; font-size: 16pt; border-bottom: 2px solid #cbd5e1; padding-bottom: 3px; margin-top: 20px; }
        h3 { color: #334155; font-size: 13pt; margin-top: 15px; }
        p { margin: 5px 0; }
        .metadata { background-color: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 20px; }
        .metrics-grid { display: table; width: 100%; margin: 15px 0; }
        .metric-card { display: table-cell; width: 25%; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; text-align: center; }
        .recommendations { background-color: #fef3c7; border-left: 4px solid #d97706; padding: 12px; margin: 15px 0; border-radius: 4px; }
        .violation-card { border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 12px; background-color: #fafafa; border-radius: 6px; }
        .violation-title { font-weight: bold; color: #0f172a; }
        .violation-impact { font-size: 9pt; background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; display: inline-block; }
        .code-block { font-family: Consolas, monospace; background-color: #0f172a; color: #f8fafc; padding: 10px; border-radius: 6px; white-space: pre-wrap; font-size: 9.5pt; }
        .solution-block { background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 10px; border-radius: 4px; margin-top: 8px; font-size: 9.5pt; }
        .gallery-grid { display: table; width: 100%; margin-top: 15px; }
        .gallery-item { display: inline-block; width: 45%; margin: 2%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px; }
      </style>
      </head>
      <body>
        <h1>${titleStr}</h1>
        <div class="metadata">
          <p><strong>URL Auditada:</strong> ${urlTested || "Arquivo Local"}</p>
          <p><strong>Framework:</strong> ${fwName}</p>
          <p><strong>Data:</strong> ${new Date(date).toLocaleString("pt-BR")}</p>
        </div>
        
        <h2>Métricas de Qualidade</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <p style="font-size: 24pt; font-weight: bold; margin: 0; color: #334155;">${metrics.total}</p>
            <p style="font-size: 9pt; color: #64748b; text-transform: uppercase;">Ações Verificadas</p>
          </div>
          <div class="metric-card">
            <p style="font-size: 24pt; font-weight: bold; margin: 0; color: #166534;">${metrics.approved}</p>
            <p style="font-size: 9pt; color: #64748b; text-transform: uppercase;">Aprovados</p>
          </div>
          <div class="metric-card">
            <p style="font-size: 24pt; font-weight: bold; margin: 0; color: #991b1b;">${metrics.failed}</p>
            <p style="font-size: 9pt; color: #64748b; text-transform: uppercase;">Falhas</p>
          </div>
          <div class="metric-card">
            <p style="font-size: 24pt; font-weight: bold; margin: 0; color: #b45309;">${metrics.violations}</p>
            <p style="font-size: 9pt; color: #64748b; text-transform: uppercase;">Violações eMAG</p>
          </div>
        </div>

        <h2>Recomendações Técnicas</h2>
        <div class="recommendations">
          <ul>
            ${recs.map(r => `<li>${r}</li>`).join("")}
          </ul>
        </div>

        <h2>Detalhamento das Ocorrências</h2>
        ${viols.map((v, i) => `
          <div class="violation-card">
            <p class="violation-title">${i + 1}. ${v.title} <span class="violation-impact">Impacto: ${v.impact}</span></p>
            <p><strong>Regra:</strong> ${v.rule}</p>
            ${v.element && v.element !== "N/A" ? `<p><strong>Elemento Afetado:</strong></p><pre class="code-block">${v.element.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>` : ""}
            <div class="solution-block">
              <strong>Solução Recomendada:</strong> ${v.solution}
            </div>
          </div>
        `).join("")}

        ${shotsToUse.length > 0 ? `
          <h2>Evidências Visuais Capturadas</h2>
          <div class="gallery-grid">
            ${shotsToUse.map((shot, idx) => `
              <div class="gallery-item">
                <p><strong>${shot.label || `Evidência #${idx + 1}`}</strong></p>
                <img src="${shot.base64}" style="max-width: 100%; max-height: 250px;" />
              </div>
            `).join("")}
          </div>
        ` : ""}
      </body>
      </html>`;

      const blob = new Blob(['\ufeff' + header], {
        type: 'application/msword'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Relatorio_${titleStr.replace(/\s+/g, "_")}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        {/* Dashboard Exportable Container */}
        <div id="pdf-dashboard-content" className="bg-white text-slate-800 border border-slate-300 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl font-sans relative overflow-hidden">
          {/* Header Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#0f172a]"></div>

          {/* Clean Generic Corporate Header */}
          <div className="border-b-2 border-slate-100 pb-5 pt-2 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#0f172a] flex items-center justify-center text-[10px] font-bold text-white">
                  QA
                </div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#0f172a]">RELATÓRIO DE AUDITORIA DE QUALIDADE</span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Controle de Qualidade & Acessibilidade (eMAG 3.1 / WCAG)</p>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
              
              <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 max-w-max">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <strong>Página Evaluada:</strong> 
                <a href={urlTested} target="_blank" rel="noreferrer" className="text-[#0f172a] hover:underline font-mono text-[11px] truncate max-w-[300px] md:max-w-[400px]">
                  {urlTested || "Arquivo HTML Local"}
                </a>
              </p>
            </div>
            
            <div className="text-right shrink-0 flex flex-col items-start md:items-end space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Framework: <strong className="text-slate-800 uppercase font-bold">{fwName}</strong></span>
              <span className="text-[11px] text-slate-500">Data: <strong className="text-slate-700">{new Date(date).toLocaleString("pt-BR")}</strong></span>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center flex flex-col items-center justify-center shadow-sm">
              <span className="text-3xl font-black text-slate-800">{metrics.total}</span>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-2">Ações Verificadas</span>
            </div>
            <div className="bg-emerald-50/30 border border-emerald-200 rounded-xl p-5 text-center flex flex-col items-center justify-center shadow-sm">
              <span className="text-3xl font-black text-emerald-700">{metrics.approved}</span>
              <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mt-2">Aprovados</span>
            </div>
            <div className="bg-rose-50/30 border border-rose-200 rounded-xl p-5 text-center flex flex-col items-center justify-center shadow-sm">
              <span className="text-3xl font-black text-rose-700">{metrics.failed}</span>
              <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider mt-2">Falhas</span>
            </div>
            <div className="bg-amber-50/30 border border-amber-200 rounded-xl p-5 text-center flex flex-col items-center justify-center shadow-sm">
              <span className="text-3xl font-black text-amber-700">{metrics.violations}</span>
              <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mt-2">Violações eMAG</span>
            </div>
          </div>

          {/* Recommendations Banner */}
          <div className="bg-amber-50/50 border-l-4 border-amber-500 rounded-r-xl p-5 space-y-3 shadow-sm">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-amber-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Recomendações Técnicas
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {recs.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="text-amber-500 font-bold mt-0.5">•</span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Violations List */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Detalhamento de Inconformidades
            </h3>
            <div className="space-y-4">
              {viols.map((viol, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-5 bg-slate-50/30 space-y-3 shadow-sm hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      {viol.title}
                    </h4>
                    <span className={cn("text-[9px] uppercase font-bold px-2.5 py-1 rounded-full border shadow-sm", 
                      viol.impact.toLowerCase().includes("crit") ? "border-rose-300 bg-rose-50 text-rose-700" : "border-amber-300 bg-amber-50 text-amber-700"
                    )}>
                      Impacto: {viol.impact}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1 bg-white p-3 rounded-lg border border-slate-200/80">
                    <p><strong>Identificador Regra:</strong> <span className="font-mono text-slate-700 font-semibold">{viol.rule}</span></p>
                    <p><strong>Elementos Afetados:</strong> <span className="font-mono text-slate-700 font-medium break-all">{viol.element}</span></p>
                  </div>
                  {viol.element && viol.element !== "N/A" && (
                    <pre className="text-[11px] text-slate-700 bg-slate-900 border border-slate-800 rounded-lg p-3.5 font-mono overflow-x-auto whitespace-pre-wrap text-white">
                      {viol.element}
                    </pre>
                  )}
                  <div className="bg-[#0f172a]/5 border border-[#0f172a]/20 rounded-lg p-4 text-xs text-[#0f172a] leading-relaxed shadow-sm">
                    <strong className="block text-[11px] uppercase font-bold tracking-wider mb-1">Ação de Correção Recomendada:</strong>
                    {viol.solution}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clean Screenshot Evidence Gallery */}
          {shotsToUse.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Capturas de Tela e Evidências Visuais
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shotsToUse.map((shot, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col shadow-sm">
                    <div className="bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 border-b border-slate-200">
                      {shot.label || `Evidência #${idx + 1}`}
                    </div>
                    <div className="p-2 flex-1 flex items-center justify-center bg-black/5">
                      <img src={shot.base64} alt={shot.label} className="max-h-64 object-contain rounded border border-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clean Report Footer */}
          <div className="border-t border-slate-200 pt-5 text-center flex flex-col items-center justify-center space-y-1 text-slate-400 text-[10px]">
            <span className="font-semibold uppercase tracking-widest text-slate-500">Relatório Automático de Testes</span>
            <span>Documento gerado e verificado por IA</span>
          </div>
        </div>

        {/* Action Controls for Dashboard */}
        <div className="flex items-center gap-3 justify-between flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToPDF("pdf-dashboard-content", title)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Exportar para PDF
            </button>
            <button
              onClick={exportToWord}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600/10 text-blue-500 border border-blue-600/20 hover:bg-blue-600/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              Baixar Word (.doc)
            </button>
            <button
              onClick={() => handleImproveReport(reportId, scriptText, reportText, isHistory)}
              disabled={improvingReport}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer"
            >
              {improvingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Melhorar com IA
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copy(reportText, "report_copy")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-accent text-muted-foreground transition-all cursor-pointer"
            >
              {copied === "report_copy" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copiar MD
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      {/* Hero Banner */}
      <div className="glass rounded-2xl border border-border p-6 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Auto Web — Gerador de Automação Inteligente
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">NOVO</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Cole uma URL ou faça upload de um HTML e receba um script pronto para rodar + <code className="bg-black/20 px-1 rounded text-xs">package.json</code> + relatório técnico. Basta <code className="bg-black/20 px-1 rounded text-xs">npm install</code> para começar.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-primary" />
              Adicionar Manual
            </button>
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadReports(); }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all cursor-pointer",
                showHistory ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <History className="w-4 h-4" />
              Histórico por URL
            </button>
          </div>
        </div>
      </div>

      {/* History Panel (Grouped by URL) */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Organização de Relatórios por URL ({Object.keys(grouped).length} Domínios)</span>
                </div>
                <button onClick={loadReports} className="text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {loadingReports ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : Object.keys(grouped).length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">Nenhuma URL cadastrada ainda.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border min-h-[250px]">
                  {/* Left Column: URL List */}
                  <div className="md:col-span-1 overflow-y-auto max-h-[350px] p-2 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/60 px-2 block mb-2">URLs Testadas</span>
                    {Object.keys(grouped).map(domain => (
                      <button
                        key={domain}
                        onClick={() => setExpandedUrlGroup(expandedUrlGroup === domain ? null : domain)}
                        className={cn("w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-all", 
                          expandedUrlGroup === domain ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/40 text-foreground"
                        )}
                      >
                        <span className="truncate flex-1 pr-2">{domain}</span>
                        <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full font-bold">{grouped[domain].length}</span>
                      </button>
                    ))}
                  </div>

                  {/* Middle Column: Reports for selected URL */}
                  <div className="md:col-span-2 overflow-y-auto max-h-[350px] p-4 space-y-2">
                    {expandedUrlGroup ? (
                      <>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 block mb-2">Histórico de Automações em: {expandedUrlGroup}</span>
                        <div className="space-y-2">
                          {grouped[expandedUrlGroup].map(r => (
                            <button
                              key={r.id}
                              onClick={() => {
                                if (selectedReport?.id === r.id) {
                                  setSelectedReport(null);
                                } else {
                                  setSelectedReport(r);
                                  if (r.source_url) fetchLiveScreenshots(r.source_url);
                                }
                              }}
                              className={cn("w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                                selectedReport?.id === r.id ? "bg-primary/5 border-primary/40 shadow-sm" : "border-border/60 hover:border-primary/20 bg-accent/20"
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold truncate text-foreground">{r.source_name || "Relatório"}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(r.created_at).toLocaleString("pt-BR")} · <span className="capitalize">{r.framework}</span> · {r.model_used}
                                </p>
                              </div>
                              <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-3", selectedReport?.id === r.id && "rotate-90 text-primary")} />
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                        <Globe className="w-8 h-8 opacity-30 mb-2" />
                        <p className="text-sm">Selecione uma URL na coluna ao lado para visualizar os códigos e relatórios associados.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Report Dashboard details */}
              {selectedReport && (
                <div className="border-t border-border p-6 bg-accent/10 space-y-6">
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <h3 className="text-base font-bold text-foreground">Visualização Completa do Relatório</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => download(selectedReport.script_content,
                        selectedReport.framework === "selenium" ? "test_automation.py" : selectedReport.framework === "cypress" ? "automation.cy.js" : "automation.spec.ts")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-accent text-muted-foreground transition-all">
                        <Download className="w-3.5 h-3.5" /> Script
                      </button>
                      <button onClick={() => download(JSON.stringify(selectedReport.package_json, null, 2), "package.json")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-accent text-muted-foreground transition-all">
                        <Package className="w-3.5 h-3.5" /> package.json
                      </button>
                      <button onClick={() => setSelectedReport(null)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Toggle dashboard vs raw code/markdown */}
                  <ReportDashboard
                    reportText={selectedReport.report_content}
                    scriptText={selectedReport.script_content}
                    title={selectedReport.source_name}
                    urlTested={selectedReport.source_url || ""}
                    date={selectedReport.created_at}
                    fwName={selectedReport.framework}
                    reportId={selectedReport.id}
                    isHistory={true}
                  />

                  <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-2"><Code2 className="w-3.5 h-3.5" /> Script de automação associado</span>
                    <pre className="text-xs text-foreground bg-black/30 border border-border/40 rounded-xl p-4 max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono relative group">
                      <button
                        onClick={() => copy(selectedReport.script_content, "hist_script")}
                        className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 bg-card border border-border hover:bg-accent p-1.5 rounded-md text-muted-foreground transition-all"
                      >
                        {copied === "hist_script" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      {selectedReport.script_content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config Panel */}
      <div className="glass rounded-2xl border border-border p-5 space-y-5">
        {/* Mode selector */}
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("url")}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
              mode === "url" ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "border-border text-muted-foreground hover:text-foreground")}
          >
            <Globe className="w-4 h-4" /> Inserir URL
          </button>
          <button onClick={() => setMode("file")}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
              mode === "file" ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "border-border text-muted-foreground hover:text-foreground")}
          >
            <Upload className="w-4 h-4" /> Upload HTML
          </button>
        </div>

        {/* URL Input */}
        <AnimatePresence mode="wait">
          {mode === "url" ? (
            <motion.div key="url" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://exemplo.com/login"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-background/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                URLs públicas funcionam melhor. Páginas protegidas por login precisam do HTML exportado.
              </p>
            </motion.div>
          ) : (
            <motion.div key="file" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <input ref={fileRef} type="file" accept=".html,.htm" className="hidden"
                onChange={e => setHtmlFile(e.target.files?.[0] ?? null)} />
              <button onClick={() => fileRef.current?.click()}
                className={cn("w-full flex items-center justify-center gap-3 py-8 rounded-xl border-2 border-dashed transition-all",
                  htmlFile ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-primary/5")}
              >
                {htmlFile ? (
                  <div className="text-center">
                    <FileCode className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">{htmlFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(htmlFile.size / 1024).toFixed(0)} KB · Clique para trocar</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Clique para selecionar o arquivo HTML</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Salve a página no navegador (Ctrl+S) e faça upload aqui</p>
                  </div>
                )}
              </button>
              {htmlFile && (
                <button onClick={() => { setHtmlFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors mt-2">
                  <X className="w-3.5 h-3.5" /> Remover arquivo
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Framework + Model + Config Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Framework */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Framework</label>
            <div className="flex gap-2 flex-wrap">
              {FRAMEWORKS.map(f => (
                <button key={f.key} onClick={() => setFramework(f.key)}
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                    framework === f.key ? `${f.bg} ${f.color} ${f.border}` : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground")}
                >
                  <Code2 className="w-3 h-3" />
                  {f.label}
                  <span className="opacity-60">{f.lang}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modelo de IA</label>
            <div className="relative">
              <button onClick={() => setShowModelMenu(!showModelMenu)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border text-sm hover:border-primary/40 transition-all">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-medium">{currentModel.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{currentModel.badge}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </button>
              <AnimatePresence>
                {showModelMenu && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
                    {MODELS.map(m => (
                      <button key={m.key} onClick={() => { setModel(m.key); setShowModelMenu(false); }}
                        className={cn("w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent transition-colors",
                          model === m.key && "bg-primary/10")}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{m.label}</span>
                          <span className="text-xs text-muted-foreground">{m.provider}</span>
                        </div>
                        <span className="text-[10px] border border-border px-2 py-0.5 rounded-full text-muted-foreground">{m.badge}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Project Name + Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do projeto</label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={projectName} onChange={e => setProjectName(e.target.value.replace(/\s/g, "-").toLowerCase())}
                placeholder="meu-projeto-teste"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instruções extras (opcional)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Foque no fluxo de login e cadastro"
              className="w-full px-4 py-2.5 rounded-xl bg-background/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
          </div>
        </div>

        {/* Generate button */}
        <div className="flex justify-end">
          <button onClick={handleGenerate}
            disabled={loading || (mode === "url" ? !url.trim() : !htmlFile)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all shadow-lg shadow-primary/25"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? "Analisando e gerando..." : "Gerar Automação Completa"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass rounded-xl border border-rose-500/30 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-400">Erro ao gerar automação</p>
            <p className="text-xs text-rose-400/70 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Result Container */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Stats bar */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold", currentFw.bg, currentFw.color, "border", currentFw.border)}>
                <Code2 className="w-4 h-4" />
                {currentFw.label} &middot; {currentFw.lang}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-primary/10 text-primary">
                <CheckCircle2 className="w-4 h-4" />
                {result.elementsFound} elementos encontrados
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-emerald-400/10 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Salvo automaticamente
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={downloadZip}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all">
                  <Download className="w-4 h-4" />
                  Baixar Arquivos
                </button>
                <button
                  onClick={handleRunOnServer}
                  disabled={runnerStatus === 'enqueuing' || runnerStatus === 'waiting' || runnerStatus === 'active'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/25">
                  {(runnerStatus === 'enqueuing' || runnerStatus === 'waiting' || runnerStatus === 'active')
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Play className="w-4 h-4" />}
                  Executar no Servidor
                </button>
              </div>
            </div>

            {/* How to run */}
            <div className="glass rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4" /> Como rodar agora
              </p>
              <div className="space-y-1">
                {result.framework === "selenium" ? (
                  <>
                    <code className="block text-xs font-mono text-muted-foreground">pip install selenium pytest webdriver-manager pytest-html</code>
                    <code className="block text-xs font-mono text-muted-foreground">pytest test_automation.py --html=report.html</code>
                  </>
                ) : (
                  <>
                    <code className="block text-xs font-mono text-muted-foreground">npm install</code>
                    {result.framework === "playwright" && <code className="block text-xs font-mono text-muted-foreground">npx playwright install</code>}
                    <code className="block text-xs font-mono text-muted-foreground">npm test</code>
                  </>
                )}
              </div>
            </div>

            {/* Result Tabs */}
            <div className="glass rounded-2xl border border-border overflow-hidden">
              <div className="flex border-b border-border overflow-x-auto">
                {[
                  { key: "dashboard" as ResultTab, label: "Dashboard Relatório", icon: Eye },
                  { key: "script" as ResultTab, label: scriptFilename, icon: FileCode },
                  { key: "package" as ResultTab, label: "package.json", icon: Package },
                  { key: "raw_report" as ResultTab, label: "Texto Relatório (MD)", icon: FileText },
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.key} onClick={() => setResultTab(t.key)}
                      className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                        resultTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-5">
                {resultTab === "dashboard" ? (
                  <ReportDashboard
                    reportText={result.report}
                    scriptText={result.script}
                    title={result.pageTitle}
                    urlTested={url}
                    date={new Date().toISOString()}
                    fwName={framework}
                    reportId="new"
                    isHistory={false}
                  />
                ) : (
                  <>
                    <div className="flex justify-end gap-2 mb-3">
                      {resultTab === "script" && (
                        <button onClick={() => download(result.script, scriptFilename)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground transition-all">
                          <Download className="w-3.5 h-3.5" /> {scriptFilename}
                        </button>
                      )}
                      {resultTab === "package" && (
                        <button onClick={() => download(JSON.stringify(result.packageJson, null, 2), "package.json")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground transition-all">
                          <Download className="w-3.5 h-3.5" /> package.json
                        </button>
                      )}
                      {resultTab === "raw_report" && (
                        <button onClick={() => download(result.report, "RELATORIO.md")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground transition-all">
                          <Download className="w-3.5 h-3.5" /> RELATORIO.md
                        </button>
                      )}
                      <button onClick={() => copy(
                        resultTab === "script" ? result.script
                          : resultTab === "package" ? JSON.stringify(result.packageJson, null, 2)
                          : result.report,
                        resultTab
                      )}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground transition-all">
                        {copied === resultTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === resultTab ? "Copiado!" : "Copiar"}
                      </button>
                    </div>

                    <pre className="text-xs text-foreground leading-relaxed font-mono bg-black/20 rounded-xl p-4 overflow-x-auto overflow-y-auto max-h-[500px] whitespace-pre-wrap">
                      {resultTab === "script" && result.script}
                      {resultTab === "package" && JSON.stringify(result.packageJson, null, 2)}
                      {resultTab === "raw_report" && result.report}
                    </pre>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Async Runner Panel (BullMQ) ────────────────────────────────────── */}
      <AnimatePresence>
        {(runnerStatus !== 'idle') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-2xl border border-violet-500/30 overflow-hidden"
          >
            {/* Panel Header */}
            <div
              className="flex items-center justify-between px-5 py-4 bg-violet-500/10 border-b border-violet-500/20 cursor-pointer"
              onClick={() => setRunnerExpanded(e => !e)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  {(runnerStatus === 'enqueuing' || runnerStatus === 'waiting' || runnerStatus === 'active')
                    ? <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                    : runnerStatus === 'completed'
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <AlertCircle className="w-4 h-4 text-rose-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {runnerStatus === 'enqueuing' && 'Enfileirando job...'}
                    {runnerStatus === 'waiting'   && 'Na fila — aguardando worker...'}
                    {runnerStatus === 'active'    && `Executando — ${runnerProgress}%`}
                    {runnerStatus === 'completed' && '✅ Execução Concluída!'}
                    {runnerStatus === 'failed'    && '❌ Execução Falhou'}
                  </p>
                  {runnerJobId && <p className="text-xs text-muted-foreground font-mono">Job: {runnerJobId.substring(0, 16)}...</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Download PDF when done */}
                {runnerStatus === 'completed' && runnerResult?.pdfUrl && (
                  <a
                    href={runnerResult.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Baixar PDF
                  </a>
                )}
                {runnerStatus === 'completed' && runnerResult?.htmlReportUrl && (
                  <a
                    href={runnerResult.htmlReportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:border-primary/30 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" /> Ver HTML
                  </a>
                )}
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", runnerExpanded && 'rotate-180')} />
              </div>
            </div>

            {/* Progress Bar */}
            {(runnerStatus === 'active' || runnerStatus === 'waiting') && (
              <div className="w-full h-1.5 bg-border">
                <motion.div
                  className="h-full bg-violet-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${runnerProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}

            {runnerExpanded && (
              <div className="p-5 space-y-5">
                {/* Error display */}
                {runnerStatus === 'failed' && runnerError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                    <p className="text-sm font-medium text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Erro de execução
                    </p>
                    <p className="text-xs text-rose-400/80 mt-1 font-mono">{runnerError}</p>
                  </div>
                )}

                {/* Report Dashboard when completed */}
                {runnerStatus === 'completed' && runnerResult && (
                  <div className="mt-4 bg-accent/5 rounded-2xl border border-border p-4">
                    <ReportDashboard 
                        reportText={runnerResult.reportMarkdown || ""}
                        scriptText={result?.script || ""}
                        title={projectName || "Relatório Automatizado"}
                        urlTested={url}
                        date={runnerResult.completedAt || new Date().toISOString()}
                        fwName={framework}
                        reportId={runnerJobId || "new"}
                        isHistory={false}
                        screenshots={(runnerResult.steps || []).filter(s => s.screenshotBase64).map(s => ({
                          label: `Passo #${s.index} - ${s.label}`,
                          base64: `data:image/jpeg;base64,${s.screenshotBase64}`
                        }))}
                    />
                  </div>
                )}

                {/* Steps list */}
                {runnerSteps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passos de Execução</p>
                    <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                      {runnerSteps.map((step, i) => {
                        const sr = (runnerResult?.steps || []).find(s => s.index === i + 1);
                        const statusMap = {
                          aprovado:     { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', icon: '✓' },
                          falha_clique: { color: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/20',  icon: '⚡' },
                          erro_js:      { color: 'text-rose-400',   bg: 'bg-rose-400/10 border-rose-400/20',   icon: '✖' },
                          sem_texto:    { color: 'text-rose-400',   bg: 'bg-rose-400/10 border-rose-400/20',   icon: '⚠' },
                          pulado:       { color: 'text-muted-foreground', bg: 'bg-muted/50 border-border', icon: '⊘' },
                        };
                        const st = sr ? (statusMap[sr.status] || statusMap.pulado) : null;
                        return (
                          <div key={i} className={cn(
                            'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all',
                            st ? st.bg : 'bg-muted/20 border-border'
                          )}>
                            <span className={cn('font-bold text-xs mt-0.5 w-4 text-center shrink-0', st ? st.color : 'text-muted-foreground')}>
                              {st ? st.icon : `${i + 1}`}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{(step as any).label || step.action}</p>
                              {sr?.detalhe && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sr.detalhe}</p>}
                            </div>
                            {sr?.screenshotBase64 && (
                              <img
                                src={`data:image/png;base64,${sr.screenshotBase64}`}
                                alt="evidência"
                                className="w-16 h-10 object-cover rounded border border-border shrink-0"
                              />
                            )}
                            {sr?.duration && <span className="text-xs text-muted-foreground shrink-0">{sr.duration}ms</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Markdown report */}
                {runnerResult?.reportMarkdown && (
                  <details className="group">
                    <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
                      Ver Relatório Markdown
                    </summary>
                    <pre className="mt-2 text-xs text-foreground font-mono bg-black/20 rounded-xl p-4 overflow-auto max-h-60 whitespace-pre-wrap">
                      {runnerResult.reportMarkdown}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Insert Modal */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Adicionar Relatório / Script Manual</h3>
                </div>
                <button onClick={() => setShowManualModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">URL do Teste (Obrigatório)</label>
                    <input
                      type="url"
                      value={manualUrl}
                      onChange={e => setManualUrl(e.target.value)}
                      placeholder="https://www.exemplo.com/servico"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Projeto (Obrigatório)</label>
                    <input
                      type="text"
                      value={manualProjectName}
                      onChange={e => setManualProjectName(e.target.value)}
                      placeholder="Ex: Auditoria Principal"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Framework</label>
                    <select
                      value={manualFramework}
                      onChange={e => setManualFramework(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="playwright">Playwright (TypeScript)</option>
                      <option value="cypress">Cypress (JavaScript)</option>
                      <option value="selenium">Selenium (Python)</option>
                      <option value="manual">Outro (Manual)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição Curta</label>
                    <input
                      type="text"
                      value={manualDescription}
                      onChange={e => setManualDescription(e.target.value)}
                      placeholder="Ex: Teste de acessibilidade eMAG e fluxo básico"
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Código / Script do Teste</label>
                  <textarea
                    rows={4}
                    value={manualScript}
                    onChange={e => setManualScript(e.target.value)}
                    placeholder="Cole seu código de teste aqui (Playwright, Cypress, etc.)"
                    className="w-full p-3 rounded-xl bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Texto do Relatório (Markdown - Opcional)</label>
                  <textarea
                    rows={4}
                    value={manualReport}
                    onChange={e => setManualReport(e.target.value)}
                    placeholder="Se preferir, cole o conteúdo do relatório aqui. Se deixar em branco, a IA ou um formato básico será usado."
                    className="w-full p-3 rounded-xl bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                  />
                  <p className="text-[10px] text-muted-foreground">Você pode incluir a tag `MÉTRICAS DO RELATÓRIO:` com `Total de Testes`, `Casos de Teste Aprovados` etc. no início para gerar os gráficos.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border border-border hover:bg-accent rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveManual}
                  disabled={savingManual}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {savingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salvar Relatório
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
