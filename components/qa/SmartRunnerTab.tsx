"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Zap, Loader2, FileDown, Eye, CheckCircle2,
  AlertCircle, ChevronDown, Play, Sparkles, RefreshCw,
  Target, Shield, BarChart3, Clock, ArrowRight, List,
  Image as ImageIcon, X, Edit3, FileText, Printer, Upload,
  Search, ShieldCheck, Link2Off, Bot, Activity, CheckCircle, Code, Code2
} from "lucide-react";

import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────────────────
// Modelos disponíveis
// ──────────────────────────────────────────────────────────────────────────────
const MODELS = [
  { key: "auto-free",     label: "Automático (Recomendado)", provider: "OpenRouter", badge: "Gratuito" },
  { key: "nemotron-super",label: "Nemotron 3 Super",         provider: "Nvidia",     badge: "Gratuito" },
  { key: "laguna-xs",     label: "Laguna XS 2.1",           provider: "Poolside",   badge: "Gratuito" },
  { key: "gpt-oss",       label: "GPT OSS 20B",             provider: "OpenAI",     badge: "Gratuito" },
  { key: "qwen-coder",    label: "Qwen 2.5 Coder",          provider: "Alibaba",    badge: "Código" },
];

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────
interface StepResult {
  index: number;
  label: string;
  status: "aprovado" | "falha_clique" | "erro_js" | "pulado";
  detalhe: string;
  screenshotBase64?: string;
  screenshotBeforeBase64?: string;
  screenshotElementBase64?: string;
  duration?: number;
}

type RunPhase = "idle" | "running" | "done" | "error";

interface RunResult {
  runId: string;
  jobName: string;
  targetUrl: string;
  totalSteps: number;
  approvedSteps: number;
  failedSteps: number;
  axeViolationsCount: number;
  steps: StepResult[];
  generatedStepsCode: string[];
  pdfUrl?: string;
  htmlReportUrl?: string;
  finalScreenshot?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Exemplos de fluxo para inspiração
// ──────────────────────────────────────────────────────────────────────────────
const FLOW_EXAMPLES = [
  {
    label: "Login Padrão",
    value: "Acesse a página de login, preencha o formulário com credenciais válidas e verifique o redirecionamento para o dashboard.",
  },
  {
    label: "Busca e Navegação",
    value: "Realize uma pesquisa na barra superior, acesse o primeiro resultado e verifique se o título condiz com a busca.",
  },
  {
    label: "Validação de Formulário",
    value: "Tente enviar o formulário principal vazio e verifique se as mensagens de erro obrigatórias aparecem.",
  },
  {
    label: "Auditoria de Acessibilidade/Layout",
    value: "Role a página até o fim verificando quebras de layout, e teste o botão de voltar ao topo.",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Status badge helper
// ──────────────────────────────────────────────────────────────────────────────
function StepBadge({ status }: { status: StepResult["status"] }) {
  const map = {
    aprovado:     { icon: "✓", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
    falha_clique: { icon: "⚡", color: "text-amber-400",  bg: "bg-amber-400/10 border-amber-400/20"  },
    erro_js:      { icon: "✖", color: "text-rose-400",   bg: "bg-rose-400/10 border-rose-400/20"   },
    pulado:       { icon: "⊘", color: "text-slate-400",  bg: "bg-slate-400/10 border-slate-400/20" },
  };
  const s = map[status] || map.pulado;
  return (
    <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border shrink-0", s.color, s.bg)}>
      {s.icon}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────────
export function SmartRunnerTab({ initialReport, onImportPdf, defaultUrl }: { initialReport?: RunResult | null, onImportPdf?: (url: string) => void, defaultUrl?: string }) {
  const [testType, setTestType]           = useState("smart_ai");
  const [targetUrl, setTargetUrl]         = useState(defaultUrl || "");
  const [flowDescription, setFlowDescription] = useState("");
  const [jobName, setJobName]             = useState("");
  const [model, setModel]                 = useState("auto-free");
  const [includeAxe, setIncludeAxe]       = useState(true);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const [phase, setPhase]         = useState<RunPhase>("idle");
  const [result, setResult]       = useState<RunResult | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  
  const [previewSteps, setPreviewSteps] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [currentPhaseMsg, setCurrentPhaseMsg] = useState("");
  const [elapsed, setElapsed]     = useState(0);
  const [showSteps, setShowSteps] = useState(true);
  const [showGenerated, setShowGenerated] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Editor de PDF
  const [showPdfEditor, setShowPdfEditor] = useState(false);
  const [editTitle, setEditTitle]         = useState("");
  const [editNotes, setEditNotes]         = useState("");
  const [generatingEditedPdf, setGeneratingEditedPdf] = useState(false);

  const [contextImages, setContextImages] = useState<string[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // History
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/ai/qa");
      if (res.ok) {
        const data = await res.json();
        const runs = (data.reports || []).filter((r: any) => r.type === 'smart_runner');
        setHistory(runs);
      }
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  // Carrega o estado salvo no localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smartRunnerState");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetUrl && !defaultUrl) setTargetUrl(parsed.targetUrl);
        if (parsed.flowDescription) setFlowDescription(parsed.flowDescription);
        if (parsed.jobName) setJobName(parsed.jobName);
        if (parsed.testType) setTestType(parsed.testType);
        if (parsed.model) setModel(parsed.model);
        if (parsed.includeAxe !== undefined) setIncludeAxe(parsed.includeAxe);
      }
    } catch (e) {
      console.error("Falha ao carregar estado do localStorage", e);
    }
  }, [defaultUrl]);

  // Se defaultUrl mudar, force o preenchimento
  useEffect(() => {
    if (defaultUrl) {
      setTargetUrl(defaultUrl);
    }
  }, [defaultUrl]);

  // Salva o estado no localStorage
  useEffect(() => {
    try {
      const state = {
        targetUrl,
        flowDescription,
        jobName,
        testType,
        model,
        includeAxe
      };
      localStorage.setItem("smartRunnerState", JSON.stringify(state));
    } catch (e) {
      console.error("Falha ao salvar estado no localStorage", e);
    }
  }, [targetUrl, flowDescription, jobName, testType, model, includeAxe]);

  // Filtra histórico pelo domínio atual
  useEffect(() => {
    const fetchUrlHistory = async () => {
      if (!targetUrl || targetUrl.length < 5) {
        setHistory([]);
        return;
      }
      try {
        setLoadingHistory(true);
        const res = await fetch("/api/ai/qa");
        if (res.ok) {
          const data = await res.json();
          let domain = targetUrl;
          try {
            const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
            domain = urlObj.hostname.replace('www.', '');
          } catch { }
          
          const filtered = (data.reports || []).filter((r: any) => 
            r.type === 'smart_runner' && 
            r.result_json && 
            r.result_json.targetUrl && 
            r.result_json.targetUrl.includes(domain)
          );
          setHistory(filtered);
        }
      } catch (err) {
        console.error("Erro ao buscar histórico:", err);
      } finally {
        setLoadingHistory(false);
      }
    };
    
    const timeoutId = setTimeout(fetchUrlHistory, 800);
    return () => clearTimeout(timeoutId);
  }, [targetUrl]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentModel = MODELS.find(m => m.key === model) || MODELS[0];

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const PHASE_MESSAGES = [
    "Iniciando o SmartRunner... (Rodando em background)",
    "Lendo o fluxo de teste e interpretando passos...",
    "Abrindo o navegador invisível e navegando no sistema...",
    "Executando ações, preenchendo campos e capturando evidências...",
    "Finalizando auditoria e gerando relatórios com capturas de tela...",
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingFile(true);
    try {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) setContextImages(prev => [...prev, ev.target!.result as string]);
          setIsProcessingFile(false);
        };
        reader.readAsDataURL(file);
      } else if (file.type === "application/json" || file.name.endsWith(".json")) {
        const text = await file.text();
        try {
          const json = JSON.parse(text);
          if (json.targetUrl || json.url) setTargetUrl(json.targetUrl || json.url);
          if (json.jobName || json.title || json.name) {
            let name = json.jobName || json.title || json.name;
            if (name.startsWith("Auditoria IA: ")) name = name.replace("Auditoria IA: ", "");
            setJobName(name);
          }
          if (json.flowDescription || json.description || json.input_description) {
            setFlowDescription(json.flowDescription || json.description || json.input_description);
          }
          if (json.testType) setTestType(json.testType);
          if (json.model) setModel(json.model);
        } catch (e) {
          alert("Arquivo JSON inválido.");
        }
        setIsProcessingFile(false);
      }
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      setIsProcessingFile(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePreview = async () => {
    if (!targetUrl.trim() || !flowDescription.trim()) return;
    setErrorMsg(null);
    setIsPreviewing(true);

    try {
      const res = await fetch("/api/automation/parse-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          flowDescription: flowDescription.trim(),
          model,
          contextImages
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao extrair passos.");
      }

      const data = await res.json();
      setPreviewSteps(JSON.stringify(data.steps, null, 2));
      setShowPreview(true);
    } catch (e: any) {
      setErrorMsg(e.message || "Erro inesperado.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const runWithPayload = async (payload: any) => {
    setPhase("running");
    setResult(null);
    setErrorMsg(null);
    setShowSteps(true);
    setLogs([]);
    startTimer();

    let msgIdx = 0;
    setCurrentPhaseMsg(PHASE_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % PHASE_MESSAGES.length;
      setCurrentPhaseMsg(PHASE_MESSAGES[msgIdx]);
    }, 5000);

    try {
      const res = await fetch("/api/automation/smart-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro do servidor: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Sem resposta do servidor.");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith('data: ')) {
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === 'log') {
                setLogs(l => [...l, ev.message]);
                if (ev.message.includes('Passo')) {
                  setCurrentPhaseMsg(ev.message);
                }
              } else if (ev.type === 'done') {
                setResult(ev.result);
                setPhase("done");
                loadHistory();
              } else if (ev.type === 'error') {
                throw new Error(ev.message);
              }
            } catch (jsonErr: any) {
              if (jsonErr.message && !jsonErr.message.includes('JSON')) throw jsonErr;
            }
          }
        }
      }

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Erro inesperado.");
      setPhase("error");
    } finally {
      clearInterval(msgInterval);
      stopTimer();
    }
  };

  const handleRun = () => {
    if (!targetUrl.trim()) return;
    if (testType === 'smart_ai' && !flowDescription.trim()) return;
    runWithPayload({
      targetUrl: targetUrl.trim(),
      flowDescription: flowDescription.trim(),
      jobName: jobName.trim() || undefined,
      model,
      includeAxe,
      testType,
      contextImages
    });
  };

  const handleRunEdited = () => {
    if (!previewSteps.trim()) return;
    let parsedSteps;
    try {
      parsedSteps = JSON.parse(previewSteps);
    } catch (e) {
      setErrorMsg("JSON de passos inválido. Corrija antes de rodar.");
      return;
    }
    setShowPreview(false);
    runWithPayload({
      targetUrl: targetUrl.trim(),
      jobName: jobName.trim() || undefined,
      testType,
      model,
      includeAxe,
      preCompiledSteps: parsedSteps
    });
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
    setElapsed(0);
    setShowSteps(true);
    setShowGenerated(false);
    setShowPdfEditor(false);
    setEditTitle("");
    setEditNotes("");
  };

  const openPdfEditor = () => {
    if (!result) return;
    setEditTitle(result.jobName || "");
    setEditNotes("");
    setShowPdfEditor(true);
  };

  const handleDownloadEditedReport = async () => {
    if (!result?.htmlReportUrl) return;
    setGeneratingEditedPdf(true);
    try {
      const res = await fetch(result.htmlReportUrl);
      let html = await res.text();
      if (editTitle.trim()) {
        html = html.replace(/<h1>([^<]*)<\/h1>/, `<h1>${editTitle.trim()}</h1>`);
        html = html.replace(/<title>[^<]*<\/title>/, `<title>${editTitle.trim()}</title>`);
      }
      if (editNotes.trim()) {
        const notesHtml = `
          <div style="margin:30px 0;padding:24px;background:#fffbeb;border:1px solid #fde68a;border-left:5px solid #f59e0b;border-radius:12px;page-break-inside:avoid;">
            <h3 style="font-family:'Outfit',sans-serif;color:#b45309;font-size:18px;margin:0 0 12px;">📝 Notas e Observações</h3>
            <p style="white-space:pre-wrap;color:#92400e;font-size:14px;line-height:1.6;margin:0;">${editNotes.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          </div>`;
        html = html.replace('<div class="footer">', notesHtml + '<div class="footer">');
      }
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.onload = () => {
          setTimeout(() => {
            win.print();
            URL.revokeObjectURL(url);
          }, 800);
        };
      }
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar PDF.');
    } finally {
      setGeneratingEditedPdf(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* ── Hero Header ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-8 mb-8 bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/30 dark:from-indigo-900/20 dark:via-violet-900/10 dark:to-transparent border border-indigo-100 dark:border-indigo-500/20 text-center shadow-sm dark:shadow-none">
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest shadow-sm">
            <Zap className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            Smart Runner Studio
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500 dark:from-white dark:to-white/60">
            Validação com <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">Inteligência & Evidências</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto font-medium">
            Execute testes automatizados a partir de código Playwright, roteiros em texto ou planos QA com capturas de tela passo a passo.
          </p>
        </div>
      </div>

      {/* ── Formulário Principal ──────────────────────────────── */}
      <AnimatePresence>
        {(phase === "idle" || phase === "error") && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border dark:border-white/5 bg-card dark:bg-black/40 backdrop-blur-2xl p-6 md:p-8 space-y-8 shadow-2xl"
          >
            {/* URL Alvo */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1">
                URL Alvo
              </label>
              <div className="relative group">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="url"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://ia.transportes.gov.br/"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm text-base font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            </div>

            {/* Tipo de Teste */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1">
                Motor de Execução
              </label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { key: 'smart_ai', title: 'Exploração IA / Script', desc: 'Playwright & Roteiros', icon: Bot, color: 'from-violet-500/20 to-indigo-500/20', border: 'border-violet-500/30', text: 'text-violet-400' },
                  { key: 'seo', title: 'Auditoria SEO', desc: 'Validação de Meta e Tags', icon: Search, color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
                  { key: 'accessibility', title: 'Acessibilidade', desc: 'Análise eMAG/WCAG', icon: ShieldCheck, color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
                  { key: 'broken_links', title: 'Links Quebrados', desc: 'Varredura de falhas 404', icon: Link2Off, color: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-500/30', text: 'text-rose-400' }
                ].map(t => {
                  const Icon = t.icon;
                  const isActive = testType === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTestType(t.key)}
                      className={cn(
                        "relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-300 overflow-hidden group",
                        isActive ? `bg-gradient-to-br ${t.color} ${t.border} shadow-lg` : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-indigo-300"
                      )}
                    >
                      <div className={cn("p-2 rounded-xl mb-3 transition-colors", isActive ? "bg-white/60 dark:bg-white/10" : "bg-gray-100 dark:bg-white/5")}>
                        <Icon className={cn("w-5 h-5", isActive ? t.text : "text-muted-foreground")} />
                      </div>
                      <h4 className="font-bold text-sm">{t.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Roteiro / Código Playwright */}
            {testType === 'smart_ai' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-400" />
                    Fluxo de Teste / Código Playwright / Plano QA
                  </label>
                  <div className="flex gap-2 flex-wrap items-center">
                    {FLOW_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setFlowDescription(ex.value)}
                        className="text-[10px] font-semibold px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all uppercase tracking-wider"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  placeholder="Cole seu código Playwright TypeScript ou digite o roteiro passo a passo (ex: 1. Acessar..., 2. Preencher e-mail com...)"
                  className="w-full h-44 px-5 py-4 bg-slate-900 text-slate-50 border border-slate-800 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all resize-y font-mono placeholder:text-slate-400 shadow-inner"
                />
              </div>
            )}

            {/* Nome da Execução */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1">
                Nome da Execução <span className="text-muted-foreground/60 font-medium normal-case text-[10px] ml-1">(opcional)</span>
              </label>
              <div className="relative group">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="Ex: [QA] TC001 - Validar Login no IA Soberana"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            {/* Ações e Botões */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-white/10">
              {/* Toggle Axe */}
              <button
                onClick={() => setIncludeAxe(!includeAxe)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                  includeAxe
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "border-border text-muted-foreground"
                )}
              >
                <Shield className="w-4 h-4" />
                Auditoria Acessibilidade {includeAxe ? "ON" : "OFF"}
              </button>

              <div className="flex items-center gap-3 ml-auto w-full sm:w-auto">
                {testType === 'smart_ai' && (
                  <button
                    onClick={handlePreview}
                    disabled={!targetUrl.trim() || !flowDescription.trim() || isPreviewing}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-semibold text-sm transition-all disabled:opacity-40"
                  >
                    {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    Pré-visualizar & Editar
                  </button>
                )}

                <button
                  onClick={handleRun}
                  disabled={!targetUrl.trim() || (testType === 'smart_ai' && !flowDescription.trim())}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/25 disabled:opacity-40 transition-all"
                >
                  <Play className="w-4 h-4" />
                  Gerar e Executar
                </button>
              </div>
            </div>

            {/* Error box */}
            {phase === "error" && errorMsg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-400">Falha na Execução</p>
                  <p className="text-xs text-rose-300 mt-1 font-mono">{errorMsg}</p>
                </div>
                <button onClick={reset} className="text-rose-400 hover:text-rose-300 p-1">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tela de Progresso ──────────────────────────────── */}
      <AnimatePresence>
        {phase === "running" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-indigo-500/30 bg-card/90 dark:bg-black/60 backdrop-blur-3xl p-10 text-center space-y-8 shadow-2xl relative overflow-hidden"
          >
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin"></div>
              <div className="absolute inset-3 rounded-full bg-indigo-500/20 animate-pulse flex items-center justify-center">
                <Activity className="w-7 h-7 text-indigo-300" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xl font-bold text-foreground">Executando Automação no Navegador</p>
              <p className="text-sm font-medium text-indigo-400 animate-pulse">{currentPhaseMsg}</p>
            </div>

            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              {formatTime(elapsed)} decorridos
            </div>

            {/* Terminal de Logs */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 h-64 overflow-y-auto text-left font-mono text-xs flex flex-col gap-1 w-full max-w-3xl mx-auto shadow-inner">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400 font-sans">
                <span>Console Playwright</span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Ao Vivo
                </span>
              </div>
              {logs.length === 0 && <span className="text-slate-500">Iniciando motor Playwright...</span>}
              {logs.map((log, idx) => (
                <div key={idx} className={
                  log.includes('Aprovado') ? 'text-emerald-400 font-medium' :
                  log.includes('Falhou') || log.includes('Falha') || log.includes('Erro') ? 'text-rose-400 font-medium' :
                  log.startsWith('[SmartRun]') ? 'text-indigo-300' :
                  'text-slate-300'
                }>
                  <span className="text-slate-600 mr-2">&gt;</span>
                  {log}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tela de Resultado com Evidências ───────────────── */}
      <AnimatePresence>
        {phase === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Status Header */}
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-center justify-between flex-wrap gap-4 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{result.jobName || "Execução SmartRunner"}</p>
                  <p className="text-sm text-emerald-400/80 font-medium flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" />
                    {result.targetUrl} <span className="text-muted-foreground/50 mx-1">•</span> {formatTime(elapsed)} decorridos
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {result.htmlReportUrl && (
                  <button
                    onClick={openPdfEditor}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/25 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                    Editar & Imprimir PDF
                  </button>
                )}
                {result.pdfUrl && (
                  <a
                    href={result.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-surface-hover transition-all"
                  >
                    <FileDown className="w-4 h-4" />
                    PDF Original
                  </a>
                )}
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Novo Teste
                </button>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total de Passos", value: result.totalSteps,          color: "text-indigo-400",    border: "border-indigo-500/20",   icon: Target },
                { label: "Aprovados",       value: result.approvedSteps,       color: "text-emerald-400",   border: "border-emerald-500/20",  icon: CheckCircle },
                { label: "Falhas",          value: result.failedSteps,         color: "text-rose-400",      border: "border-rose-500/20",     icon: AlertCircle },
                { label: "Acessibilidade",  value: result.axeViolationsCount,  color: "text-amber-400",     border: "border-amber-500/20",    icon: Shield },
              ].map(m => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className={cn("rounded-2xl p-5 border text-center bg-card shadow-sm", m.border)}>
                    <Icon className={cn("w-6 h-6 mx-auto mb-2", m.color)} />
                    <p className={cn("text-3xl font-extrabold", m.color)}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-bold uppercase tracking-widest">{m.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Detalhes dos Passos com Evidências Visuais */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <p className="text-base font-bold text-foreground">
                    Evidências Visuais dos Passos ({result.steps?.length || 0})
                  </p>
                </div>
                <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", showSteps && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showSteps && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="divide-y divide-border">
                      {result.steps?.map((step) => (
                        <div key={step.index} className="p-6 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <StepBadge status={step.status} />
                              <div>
                                <p className="text-sm font-bold text-foreground">{step.label}</p>
                                <p className="text-xs text-muted-foreground mt-1 font-mono">{step.detalhe}</p>
                                {step.duration && (
                                  <p className="text-[11px] text-muted-foreground/60 mt-1">⏱ {step.duration}ms</p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-bold">
                              #{step.index}
                            </span>
                          </div>

                          {/* Print da Tela */}
                          {step.screenshotBase64 && (
                            <div className="rounded-xl overflow-hidden border border-border bg-black/5 dark:bg-black/40 max-w-2xl">
                              <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>Evidência da Tela</span>
                                <a
                                  href={`data:image/jpeg;base64,${step.screenshotBase64}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" /> Ver em tela cheia
                                </a>
                              </div>
                              <img
                                src={`data:image/jpeg;base64,${step.screenshotBase64}`}
                                alt={`Evidência do passo ${step.index}`}
                                className="w-full object-contain max-h-96"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Screenshot Final */}
            {result.finalScreenshot && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-400" />
                  <p className="text-base font-bold text-foreground">Estado Final da Aplicação</p>
                </div>
                <img
                  src={`data:image/jpeg;base64,${result.finalScreenshot}`}
                  alt="Estado final"
                  className="w-full rounded-xl border border-border object-contain max-h-96"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal de Edição & Impressão de PDF ─────────────── */}
      <AnimatePresence>
        {showPdfEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Printer className="w-5 h-5 text-amber-500" />
                  Editar Relatório para Impressão / PDF
                </h3>
                <button onClick={() => setShowPdfEditor(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Título do Relatório</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Notas e Observações</label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    rows={4}
                    placeholder="Adicione observações para o relatório final..."
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => setShowPdfEditor(false)}
                  className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDownloadEditedReport}
                  disabled={generatingEditedPdf}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-lg shadow-amber-500/25"
                >
                  {generatingEditedPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Abrir para Imprimir / Salvar PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal de Pré-visualização & Edição JSON ───────── */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-border bg-background/50">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-indigo-400" />
                    Revisar Passos Gerados
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Edite o JSON abaixo se desejar ajustar seletores ou textos antes de rodar o teste no navegador.
                  </p>
                </div>
                <button onClick={() => setShowPreview(false)} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto font-mono text-sm bg-slate-950">
                <textarea
                  value={previewSteps}
                  onChange={(e) => setPreviewSteps(e.target.value)}
                  className="w-full h-full min-h-[380px] bg-transparent border-0 text-slate-100 focus:outline-none resize-y font-mono"
                  spellCheck={false}
                />
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-background/50">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRunEdited}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/25"
                >
                  <Play className="w-4 h-4" />
                  Executar Teste
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
