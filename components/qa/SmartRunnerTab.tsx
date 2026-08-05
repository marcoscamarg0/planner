"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Zap, Loader2, FileDown, Eye, CheckCircle2,
  AlertCircle, ChevronDown, Play, Sparkles, RefreshCw,
  Target, Shield, BarChart3, Clock, ArrowRight, List,
  Image as ImageIcon, X, Edit3, FileText, Printer, Upload,
  Search, ShieldCheck, Link2Off, Bot, Activity, CheckCircle, Code
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

  useEffect(() => {
    if (defaultUrl && !targetUrl) {
      setTargetUrl(defaultUrl);
    }
  }, [defaultUrl]);
  const [currentPhaseMsg, setCurrentPhaseMsg] = useState("");
  const [elapsed, setElapsed]     = useState(0);
  const [showSteps, setShowSteps] = useState(false);
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
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/ai/qa");
      if (res.ok) {
        const data = await res.json();
        // Filter smart_runner entries only
        const runs = (data.reports || []).filter((r: any) => r.type === 'smart_runner');
        setHistory(runs);
      }
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  // Carrega o estado salvo no localStorage (cookies/sessão do navegador)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("smartRunnerState");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetUrl) setTargetUrl(parsed.targetUrl);
        if (parsed.flowDescription) setFlowDescription(parsed.flowDescription);
        if (parsed.jobName) setJobName(parsed.jobName);
        if (parsed.testType) setTestType(parsed.testType);
        if (parsed.model) setModel(parsed.model);
        if (parsed.includeAxe !== undefined) setIncludeAxe(parsed.includeAxe);
      }
    } catch (e) {
      console.error("Falha ao carregar estado do localStorage", e);
    }
  }, []);

  // Salva o estado no localStorage sempre que ele mudar
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
  }, [targetUrl, flowDescription, jobName, testType, model, includeAxe]);  // Efeito para carregar o histórico baseado na URL atual
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
          // Filter dynamically based on the current URL
          const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
          const domain = urlObj.hostname.replace('www.', '');
          
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
    "Iniciando o SmartRunner... (Rodando em background, você pode fechar esta aba se quiser)",
    "Lendo o fluxo de teste e gerando passos inteligentes...",
    "Abrindo o navegador invisível e validando os seletores (Fique tranquilo, o teste continuará mesmo se sair)...",
    "Navegando pela página e extraindo evidências visuais...",
    "Isso pode levar alguns minutos dependendo do tamanho do fluxo. O resultado aparecerá no seu histórico lateral!",
  ];

  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) return resolve((window as any).pdfjsLib);
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        const pdfjs = (window as any).pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        resolve(pdfjs);
      };
      script.onerror = () => reject(new Error("Falha ao carregar PDF.js"));
      document.head.appendChild(script);
    });
  };

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
      } else if (file.type === "application/pdf") {
        const pdfjs = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const images: string[] = [];
        for (let i = 1; i <= Math.min(pdfDoc.numPages, 5); i++) { // Max 5 pages limit
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            images.push(canvas.toDataURL("image/jpeg", 0.7));
          }
        }
        setContextImages(prev => [...prev, ...images]);
        setIsProcessingFile(false);
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

  const handleRun = async () => {
    if (!targetUrl.trim()) return;
    if (testType === 'smart_ai' && !flowDescription.trim()) return;
    
    setPhase("running");
    setResult(null);
    setErrorMsg(null);
    setShowSteps(false);
    startTimer();

    // Anima mensagens de fase


    let msgIdx = 0;
    setCurrentPhaseMsg(PHASE_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % PHASE_MESSAGES.length;
      setCurrentPhaseMsg(PHASE_MESSAGES[msgIdx]);
    }, 5000);

    try {
      setLogs([]);
      const res = await fetch("/api/automation/smart-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          flowDescription: flowDescription.trim(),
          jobName: jobName.trim() || undefined,
          model,
          includeAxe,
          testType,
          contextImages
        }),
      });

      if (!res.body) throw new Error("Sem resposta do servidor.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Mantém o restante no buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.type === 'log') {
              setLogs(prev => [...prev, chunk.message]);
            } else if (chunk.type === 'result') {
              setResult(chunk.data);
              setPhase("done");
            } else if (chunk.type === 'error') {
              throw new Error(chunk.error);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) {
               throw e;
            }
          }
        }
      }

    } catch (e: any) {
      setErrorMsg(e.message || "Erro inesperado");
      setPhase("error");
    } finally {
      clearInterval(msgInterval);
      stopTimer();
    }
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
    setErrorMsg(null);
    setElapsed(0);
    setShowSteps(false);
    setShowGenerated(false);
    setShowPdfEditor(false);
    setEditTitle("");
    setEditNotes("");
  };

  // Abre painel de edição com valores padrão do resultado
  const openPdfEditor = () => {
    if (!result) return;
    setEditTitle(result.jobName || "");
    setEditNotes("");
    setShowPdfEditor(true);
  };

  // Gera HTML customizado e abre para impressão
  const handleDownloadEditedReport = async () => {
    if (!result?.htmlReportUrl) return;
    setGeneratingEditedPdf(true);
    try {
      // Busca o HTML original
      const res = await fetch(result.htmlReportUrl);
      let html = await res.text();

      // Injeta título customizado
      if (editTitle.trim()) {
        html = html.replace(
          /<h1>([^<]*)<\/h1>/,
          `<h1>${editTitle.trim()}</h1>`
        );
        html = html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${editTitle.trim()}</title>`
        );
      }

      // Injeta notas adicionais antes do footer
      if (editNotes.trim()) {
        const notesHtml = `
          <div style="margin:30px 0;padding:24px;background:#fffbeb;border:1px solid #fde68a;border-left:5px solid #f59e0b;border-radius:12px;page-break-inside:avoid;">
            <h3 style="font-family:'Outfit',sans-serif;color:#b45309;font-size:18px;margin:0 0 12px;">📝 Notas e Observações</h3>
            <p style="white-space:pre-wrap;color:#92400e;font-size:14px;line-height:1.6;margin:0;">${editNotes.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          </div>`;
        html = html.replace('<div class="footer">', notesHtml + '<div class="footer">');
      }

      // Abre em nova aba e dispara impressão
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
      console.error('Erro ao gerar PDF editado:', err);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGeneratingEditedPdf(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

      {/* ── Hero Header ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-8 mb-8 bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/30 dark:from-indigo-900/20 dark:via-violet-900/10 dark:to-transparent border border-indigo-100 dark:border-indigo-500/20 text-center shadow-sm dark:shadow-none">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 dark:opacity-20 mix-blend-overlay"></div>
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest shadow-sm dark:shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Zap className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            Smart Runner Studio
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-500 dark:from-white dark:to-white/60">
            Validação de Software com <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">Inteligência</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto font-medium">
            Escolha um tipo de teste, defina o alvo e deixe o robô fazer o trabalho duro. Ao final, obtenha evidências ricas e prontas para auditoria.
          </p>
        </div>
      </div>

      {/* ── Formulário ──────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === "idle" || phase === "error") && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border dark:border-white/5 bg-card dark:bg-black/40 backdrop-blur-2xl p-6 md:p-8 space-y-8 shadow-2xl"
          >
            {/* Seção 1: URL */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1">
                Alvo (URL)
              </label>
              <div className="relative group">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="url"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://www.exemplo.com.br"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none text-base font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            </div>

            {/* Seção 2: Tipo de Teste */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1">
                Motor de Execução
              </label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { key: 'smart_ai', title: 'Exploração IA', desc: 'Agente LLM interativo', icon: Bot, color: 'from-violet-500/20 to-indigo-500/20', border: 'border-violet-500/30', text: 'text-violet-400' },
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
                        isActive ? `bg-gradient-to-br ${t.color} ${t.border} shadow-[0_0_20px_rgba(0,0,0,0.05)] dark:shadow-[0_0_20px_rgba(0,0,0,0.1)]` : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none hover:border-indigo-300 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-none"
                      )}
                    >
                      {isActive && <div className="absolute inset-0 bg-white/40 dark:bg-white/5 opacity-50 mix-blend-overlay pointer-events-none"></div>}
                      <div className={cn("p-2 rounded-xl mb-3 transition-colors", isActive ? "bg-white/60 dark:bg-white/10" : "bg-gray-100 dark:bg-white/5 group-hover:bg-indigo-50 dark:group-hover:bg-white/10")}>
                        <Icon className={cn("w-5 h-5", isActive ? t.text : "text-gray-500 dark:text-muted-foreground group-hover:text-indigo-500 dark:group-hover:text-muted-foreground")} />
                      </div>
                      <h4 className={cn("font-bold text-sm", isActive ? "text-gray-900 dark:text-foreground" : "text-gray-700 dark:text-foreground/80 group-hover:text-gray-900 dark:group-hover:text-foreground")}>{t.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-muted-foreground mt-0.5">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {testType === 'smart_ai' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-400" />
                    Fluxo de Teste / Script
                  </label>
                  <div className="flex gap-2 flex-wrap items-center">
                    {FLOW_EXAMPLES.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setFlowDescription(ex.value)}
                        className="text-[10px] font-semibold px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all uppercase tracking-wider"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  placeholder="Descreva o fluxo que a IA deve executar na página..."
                  className="w-full h-32 px-5 py-4 bg-slate-900 text-slate-50 border border-slate-800 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all resize-none font-mono placeholder:text-slate-400 shadow-inner"
                />
              </div>
            )}
              
            {testType === 'smart_ai' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                    Imagens de Contexto <span className="text-muted-foreground/60 font-medium normal-case text-[10px] ml-1">(Opcional)</span>
                  </label>
                </div>
                <div className="border border-dashed border-gray-300 dark:border-white/20 rounded-2xl p-6 bg-white dark:bg-white/5 shadow-sm dark:shadow-none flex flex-col items-center justify-center gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 relative group overflow-hidden">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,application/json,.json"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    title="Envie uma imagem ou PDF (Max 5 pags)"
                  />
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
                    {isProcessingFile ? (
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    ) : (
                      <Upload className="w-6 h-6 text-indigo-400" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Arraste telas ou PDFs de protótipo</p>
                    <p className="text-xs text-muted-foreground mt-1">A IA usará como referência visual (Máx 5 pág)</p>
                  </div>
                    
                  {contextImages.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mt-4 pt-4 border-t border-white/10 w-full relative z-20">
                      {contextImages.map((img, i) => (
                        <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/20 shadow-lg group/img">
                          <img src={img} alt={`Context ${i}`} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                          <div className="absolute inset-0 bg-black/20 dark:bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setContextImages(prev => prev.filter((_, idx) => idx !== i)); }}
                              className="bg-rose-500 text-white rounded-full p-1.5 hover:scale-110 transition-transform"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-widest ml-1">
                Nome da Execução <span className="text-muted-foreground/60 font-medium normal-case text-[10px] ml-1">(opcional)</span>
              </label>
              <div className="relative group">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="Ex: Validação do fluxo de Login"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-white/10">
              {/* Seletor de Modelo */}
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 shadow-sm dark:shadow-none text-sm font-medium transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span>{currentModel.label}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                <AnimatePresence>
                  {showModelMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden"
                    >
                      {MODELS.map(m => (
                        <button
                          key={m.key}
                          onClick={() => { setModel(m.key); setShowModelMenu(false); }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors",
                            model === m.key && "bg-indigo-500/10"
                          )}
                        >
                          <div className="flex-1">
                            <p className={cn("font-medium", model === m.key ? "text-indigo-400" : "text-foreground")}>{m.label}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{m.provider} · {m.badge}</p>
                          </div>
                          {model === m.key && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Toggle Axe */}
              <button
                onClick={() => setIncludeAxe(!includeAxe)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                  includeAxe
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "border-border text-muted-foreground hover:border-border"
                )}
              >
                <Shield className="w-3.5 h-3.5" />
                Auditoria eMAG {includeAxe ? "ON" : "OFF"}
              </button>

              {/* Botão principal */}
              <button
                onClick={handleRun}
                disabled={!targetUrl.trim() || (testType === 'smart_ai' && !flowDescription.trim())}
                className="flex items-center gap-2 px-6 py-3 bg-violet-500 text-white rounded-xl text-sm font-semibold hover:bg-violet-600 disabled:opacity-40 transition-all shadow-lg shadow-violet-500/30 ml-auto"
              >
                <Play className="w-4 h-4" />
                Gerar e Executar
              </button>
            </div>

            {/* Error */}
            {phase === "error" && errorMsg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-rose-400">Erro na execução</p>
                  <p className="text-xs text-rose-400/80 mt-0.5 font-mono">{errorMsg}</p>
                </div>
                <button onClick={reset} className="ml-auto text-rose-400/60 hover:text-rose-400 transition-colors shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Histórico do Alvo Filtrado ──────────────────────── */}
      <AnimatePresence>
        {(phase === "idle" || phase === "error") && targetUrl.length >= 5 && history.length > 0 && !loadingHistory && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="rounded-3xl border border-border dark:border-white/5 bg-card dark:bg-black/40 backdrop-blur-2xl p-6 md:p-8 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-foreground">Histórico do Alvo</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                {history.length} execuções
              </span>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Execuções anteriores encontradas para este site.
            </p>

            <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10 bg-muted/30 dark:bg-white/5">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/50 dark:bg-white/5 border-b border-border dark:border-white/10 text-xs uppercase tracking-wider text-muted-foreground/80">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Data/Hora</th>
                    <th className="px-4 py-3 font-semibold">Nome do Teste</th>
                    <th className="px-4 py-3 font-semibold">Motor (Tipo)</th>
                    <th className="px-4 py-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {history.map((item: any) => {
                    const rj = item.result_json || {};
                    const steps = rj.steps || [];
                    const failed = rj.failedSteps ?? steps.filter((s: any) => s.status !== 'aprovado').length;
                    const isSuccess = failed === 0;
                    const dateObj = new Date(item.created_at);
                    const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    const testName = item.title?.replace('Auditoria IA: ', '') || 'Execução SmartRunner';
                    const motor = item.model_used || 'Desconhecido';

                    return (
                      <tr key={item.id} className="hover:bg-muted/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                            isSuccess 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}>
                            {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {isSuccess ? "Aprovado" : "Falhou"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formattedDate}</td>
                        <td className="px-4 py-3 font-medium text-foreground truncate max-w-[200px]">{testName}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{motor}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {rj.htmlReportUrl && (
                              <a href={rj.htmlReportUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-indigo-400 bg-muted/50 dark:bg-white/5 hover:bg-indigo-500/10 rounded-md transition-colors" title="Ver HTML">
                                <Eye className="w-4 h-4" />
                              </a>
                            )}
                            {rj.pdfUrl && (
                              <a href={rj.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-violet-400 bg-muted/50 dark:bg-white/5 hover:bg-violet-500/10 rounded-md transition-colors" title="Baixar PDF">
                                <FileDown className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tela de Progresso ──────────────────────────────── */}
      <AnimatePresence>
        {phase === "running" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-indigo-500/30 bg-card/90 dark:bg-black/60 backdrop-blur-3xl p-10 text-center space-y-8 shadow-[0_0_50px_rgba(99,102,241,0.15)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
            
            {/* Spinner animado avançado */}
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" style={{ animationDuration: '3s' }}></div>
              <div className="absolute inset-2 rounded-full border-r-2 border-violet-400 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>
              <div className="absolute inset-4 rounded-full bg-indigo-500/20 animate-pulse flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                <Activity className="w-8 h-8 text-indigo-300" />
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              <p className="text-xl font-bold text-foreground tracking-wide">Executando Automação Inteligente</p>
              <p className="text-sm font-medium text-indigo-400 animate-pulse">{currentPhaseMsg}</p>
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              {formatTime(elapsed)} decorridos
            </div>

            {/* Steps de progresso visual */}
            <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap relative z-10">
              {[
                { icon: Globe,     label: "Acessando URL" },
                { icon: Sparkles,  label: "Gerando Passos" },
                { icon: Play,      label: "Executando" },
                { icon: Shield,    label: "Auditoria" },
                { icon: FileDown,  label: "Evidências" },
              ].map((s, i) => {
                const Icon = s.icon;
                const isActive = Math.floor(elapsed / 8) === i;
                const isDone   = Math.floor(elapsed / 8) > i;
                return (
                  <div key={i} className="flex items-center gap-2 md:gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500",
                        isDone  ? "bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]" :
                        isActive? "bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-110" :
                                 "bg-muted/50 dark:bg-white/5 border-border dark:border-white/10"
                      )}>
                        {isDone
                          ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                          : <Icon className={cn("w-5 h-5", isActive ? "text-indigo-400 animate-pulse" : "text-muted-foreground")} />
                        }
                      </div>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider hidden md:block", isDone ? "text-emerald-400" : isActive ? "text-indigo-400" : "text-muted-foreground/50")}>
                        {s.label}
                      </span>
                    </div>
                    {i < 4 && <div className={cn("w-4 md:w-8 h-[2px] rounded-full", isDone ? "bg-emerald-500/50" : "bg-border dark:bg-white/10")} />}
                  </div>
                );
              })}
            </div>

            {/* Terminal de Logs */}
            <div className="mt-6 rounded-lg bg-slate-50 dark:bg-[#0D1117] border border-border p-4 h-56 overflow-y-auto text-left font-mono text-xs flex flex-col gap-1 w-full max-w-3xl mx-auto shadow-inner relative flex-col-reverse">
              <div className="absolute top-2 right-3 text-emerald-500 dark:text-emerald-400 font-sans text-[10px] uppercase font-bold flex items-center gap-1 bg-slate-100 dark:bg-[#0D1117] px-2 rounded-full border border-emerald-500/30 dark:border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </div>
              <div className="flex flex-col gap-1 w-full">
                {logs.length === 0 && <span className="text-muted-foreground">Aguardando início do stream...</span>}
                {logs.map((log, idx) => (
                  <div key={idx} className={
                    log.includes('✅ Aprovado') ? 'text-emerald-600 dark:text-emerald-400' :
                    log.includes('❌ Falhou') || log.includes('Falha') || log.includes('Erro') ? 'text-rose-600 dark:text-rose-400' :
                    log.startsWith('[SmartRun]') ? 'text-violet-700 dark:text-violet-300 font-semibold' :
                    'text-slate-700 dark:text-slate-300'
                  }>
                    <span className="text-slate-400 dark:text-slate-500 mr-2 text-[10px]">&gt;</span>
                    {log}
                  </div>
                ))}
                {phase === 'running' && logs.length > 0 && (
                  <div className="text-slate-500 animate-pulse">_</div>
                )}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Resultado ──────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Status header */}
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-center justify-between flex-wrap gap-4 shadow-[0_0_30px_rgba(16,185,129,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none -mr-32 -mt-32"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{result.jobName}</p>
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
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                      showPdfEditor
                        ? "bg-amber-500/20 border border-amber-500/40 text-amber-400"
                        : "bg-violet-500 text-white hover:bg-violet-600 shadow-lg shadow-violet-500/25"
                    )}
                  >
                    <Edit3 className="w-4 h-4" />
                    {showPdfEditor ? "Editando PDF" : "Editar e Baixar PDF"}
                  </button>
                )}
                {result.pdfUrl && (
                  <a
                    href={result.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-violet-500/30 transition-all"
                  >
                    <FileDown className="w-4 h-4" />
                    PDF Original
                  </a>
                )}
                <button
                  onClick={async () => {
                    if (!result) return;
                    try {
                      const res = await fetch('/api/automation/export-project', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          targetUrl: result.targetUrl,
                          jobName: result.jobName,
                          rawSteps: (result as any).rawSteps
                        })
                      });
                      if (!res.ok) throw new Error('Falha ao exportar');
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'automacao.tar.gz';
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error(e);
                      alert('Erro ao baixar o projeto');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-sm font-semibold"
                >
                  <Code className="w-4 h-4" />
                  Baixar Projeto
                </button>
                {result.pdfUrl && onImportPdf && (
                  <button
                    onClick={() => onImportPdf(result.pdfUrl!)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/30 text-sm font-semibold transition-all shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    📝 Analisar PDF em Relatórios
                  </button>
                )}
                {result.htmlReportUrl && (
                  <a
                    href={result.htmlReportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    Ver HTML
                  </a>
                )}
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Novo Teste
                </button>
              </div>
            </div>

            {/* ── Editor de PDF ──────────────────────────────────── */}
            <AnimatePresence>
              {showPdfEditor && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="glass rounded-2xl border border-amber-500/30 p-5 space-y-4 bg-amber-500/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-amber-400" />
                        <p className="text-sm font-semibold text-foreground">Editar antes de baixar</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">PDF customizado</span>
                      </div>
                      <button onClick={() => setShowPdfEditor(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Título */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          Título do Relatório
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          placeholder="Ex: Auditoria CDT Gov.br — Julho 2026"
                          className="w-full px-4 py-2.5 rounded-xl bg-background/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all"
                        />
                      </div>

                      {/* Notas */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5" />
                          Notas e Observações Adicionais
                          <span className="font-normal text-muted-foreground/60">(opcional)</span>
                        </label>
                        <textarea
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          rows={4}
                          placeholder={`Adicione contexto, observações ou recomendações que aparecerão no relatório final...\n\nExemplo:\n- Revisão aprovada pelo time de segurança em 23/07/2026\n- Pendências: corrigir contraste nos botões do header`}
                          className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all resize-none font-sans"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                      <p className="text-xs text-muted-foreground">
                        O relatório será aberto em nova aba. Use <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">Ctrl+P</kbd> ou o diálogo de impressão para salvar como PDF.
                      </p>
                      <button
                        onClick={handleDownloadEditedReport}
                        disabled={generatingEditedPdf}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/25"
                      >
                        {generatingEditedPdf
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Printer className="w-4 h-4" />
                        }
                        Abrir para Imprimir/PDF
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total de Passos", value: result.totalSteps,          color: "text-indigo-400",    border: "border-indigo-500/20",   bg: "bg-indigo-500/10",    icon: Target },
                { label: "Aprovados",       value: result.approvedSteps,       color: "text-emerald-400",   border: "border-emerald-500/20",  bg: "bg-emerald-500/10",   icon: CheckCircle },
                { label: "Falhas",          value: result.failedSteps,         color: "text-rose-400",      border: "border-rose-500/20",     bg: "bg-rose-500/10",      icon: AlertCircle },
                { label: "Violações",       value: result.axeViolationsCount,  color: "text-amber-400",     border: "border-amber-500/20",    bg: "bg-amber-500/10",     icon: Shield },
              ].map(m => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className={cn("relative group overflow-hidden rounded-2xl p-5 border text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl", m.border, "bg-muted/50 dark:bg-white/5")}>
                    <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none", m.bg)}></div>
                    <Icon className={cn("w-6 h-6 mx-auto mb-3", m.color)} />
                    <p className={cn("text-3xl font-extrabold tracking-tight", m.color)}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 font-bold uppercase tracking-widest">{m.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Screenshot final */}
            {result.finalScreenshot && (
              <div className="glass rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Estado Final da Página</p>
                </div>
                <img
                  src={`data:image/jpeg;base64,${result.finalScreenshot}`}
                  alt="Estado final"
                  className="w-full object-cover max-h-64"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            {/* Passos gerados pela IA */}
            {result.generatedStepsCode && result.generatedStepsCode.length > 0 && (
              <div className="glass rounded-2xl border border-border overflow-hidden">
                <button
                  onClick={() => setShowGenerated(!showGenerated)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-violet-400" />
                    <p className="text-sm font-semibold text-foreground">
                      Passos Gerados pela IA ({result.generatedStepsCode.length})
                    </p>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showGenerated && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {showGenerated && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 space-y-1.5">
                        {result.generatedStepsCode.map((label, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="text-xs font-mono text-violet-400 w-6 shrink-0">{i + 1}.</span>
                            {label}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Detalhes dos passos executados */}
            <div className="glass rounded-2xl border border-border overflow-hidden">
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    Detalhes de Execução com Evidências
                  </p>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showSteps && "rotate-180")} />
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
                      {result.steps.map(step => (
                        <div key={step.index} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <StepBadge status={step.status} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{step.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{step.detalhe}</p>
                              {step.duration && (
                                <p className="text-xs text-muted-foreground/60 mt-0.5">⏱ {step.duration}ms</p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground/60 shrink-0">#{step.index}</span>
                          </div>
                          {(step.screenshotBase64 || step.screenshotElementBase64) && (
                            <div className="mt-3 ml-9 relative">
                              {step.screenshotBase64 && (
                                <img
                                  src={`data:image/jpeg;base64,${step.screenshotBase64}`}
                                  alt={`Evidência passo ${step.index}`}
                                  className="rounded-lg border border-border max-h-96 object-contain shadow-sm cursor-pointer hover:opacity-95 transition-opacity w-full"
                                  onClick={() => window.open(`data:image/jpeg;base64,${step.screenshotBase64}`, "_blank")}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                              {step.screenshotElementBase64 && (
                                <img
                                  src={`data:image/jpeg;base64,${step.screenshotElementBase64}`}
                                  alt="Elemento interagido"
                                  className="absolute bottom-4 right-4 max-w-[250px] max-h-[200px] border-2 border-red-500 rounded-md shadow-lg bg-white object-contain cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => window.open(`data:image/jpeg;base64,${step.screenshotElementBase64}`, "_blank")}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Histórico de Execuções ──────────────────────────── */}
      <div className="glass rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => { setShowHistory(h => !h); if (!showHistory && history.length === 0) loadHistory(); }}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-accent/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-semibold text-foreground">Histórico de Execuções</p>
            {history.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30 font-bold">
                {history.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); loadHistory(); }}
              onKeyDown={e => e.key === 'Enter' && loadHistory()}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loadingHistory && "animate-spin")} />
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showHistory && "rotate-180")} />
          </div>
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {loadingHistory ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando histórico...
                </div>
              ) : history.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma execução encontrada.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Execute um teste para ver o histórico aqui.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {history.map((item: any) => {
                    const rj = item.result_json || {};
                    const steps: StepResult[] = rj.steps || [];
                    const approved = rj.approvedSteps ?? steps.filter((s: StepResult) => s.status === 'aprovado').length;
                    const failed   = rj.failedSteps   ?? steps.filter((s: StepResult) => s.status !== 'aprovado').length;
                    const isOpen   = selectedHistory?.id === item.id;
                    const date     = new Date(item.created_at).toLocaleString('pt-BR');

                    return (
                      <div key={item.id}>
                        {/* Header do item */}
                        <button
                          onClick={() => setSelectedHistory(isOpen ? null : item)}
                          className={cn(
                            "w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-accent/30",
                            isOpen && "bg-violet-500/5"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{item.title?.replace('Auditoria IA: ', '') || 'Execução'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {date} · {steps.length} passos ·
                              <span className="text-emerald-400 ml-1">{approved} ok</span>
                              {failed > 0 && <span className="text-rose-400 ml-1">{failed} falha(s)</span>}
                            </p>
                          </div>
                          <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 ml-3 transition-transform", isOpen && "rotate-180")} />
                        </button>

                        {/* Detalhe expandido — Caso de Teste */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-accent/5"
                            >
                              <div className="px-5 pb-5 pt-3 space-y-4">

                                {/* Cabeçalho do Caso de Teste */}
                                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Caso de Teste</p>
                                  <p className="text-sm font-semibold text-foreground">{item.title?.replace('Auditoria IA: ', '') || 'Execução SmartRunner'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    <strong>URL Testada:</strong> {rj.targetUrl || item.input_description || '—'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    <strong>Data:</strong> {date} · <strong>Modelo:</strong> {item.model_used}
                                  </p>
                                  <div className="flex gap-3 pt-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{steps.length} passos</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">{approved} aprovados</span>
                                    {failed > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-medium">{failed} falhas</span>}
                                  </div>
                                </div>

                                {/* Pré-condições */}
                                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-1.5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Pré-condições</p>
                                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>Navegador atualizado com acesso à internet.</li>
                                    <li>URL acessível publicamente: <code className="text-xs bg-background px-1 py-0.5 rounded">{rj.targetUrl || '—'}</code></li>
                                    <li>Executor: Playwright headless (Node.js).</li>
                                  </ul>
                                </div>

                                {/* Execução passo a passo */}
                                <div className="space-y-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Execução e Evidências</p>
                                  {steps.filter((s: StepResult) => {
                                    const lbl = (s.label || '').toLowerCase();
                                    if (s.status === 'aprovado' && (lbl === 'aguardar carregamento' || lbl === 'nova página criada')) return false;
                                    return true;
                                  }).map((step: StepResult, idx: number) => {
                                    const st = step.status;
                                    const statusColor = st === 'aprovado' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                                      : st === 'falha_clique' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                                      : 'text-rose-400 bg-rose-400/10 border-rose-400/20';
                                    const statusIcon = st === 'aprovado' ? '✓' : st === 'falha_clique' ? '⚡' : '✖';
                                    const statusTxt  = st === 'aprovado' ? 'Aprovado' : st === 'falha_clique' ? 'Falha' : 'Erro';

                                    // Resultado esperado
                                    const lbl = (step.label || '').toLowerCase();
                                    const resultadoEsperado = lbl.includes('acessar') || lbl.includes('goto')
                                      ? 'Página deve carregar completamente.'
                                      : lbl.includes('clicar') && lbl.includes('link') ? 'Link deve redirecionar para a página de destino.'
                                      : lbl.includes('clicar') ? 'Elemento deve ser clicado e o sistema deve reagir.'
                                      : lbl.includes('digitar') || lbl.includes('type') ? 'Campo deve exibir o texto inserido.'
                                      : lbl.includes('rolar') ? 'Página deve rolar revelando conteúdo abaixo da dobra.'
                                      : 'Sistema deve responder à ação sem erros.';

                                    // Evidência funcional
                                    const urlAlc = (step.detalhe || '').match(/url[^:]*:\s*(https?:\/\/[^\s]+)/i)?.[1] || '';
                                    const newPath = urlAlc ? (() => { try { return new URL(urlAlc).pathname; } catch { return urlAlc; } })() : '';
                                    const evidencia = st !== 'aprovado'
                                      ? `Falha registrada: "${(step.detalhe || '').replace(/^Falha:\s*/i,'').substring(0, 150)}". Elemento pode estar oculto ou seletor inválido.`
                                      : lbl.includes('clicar') && lbl.includes('link')
                                        ? `Screenshot da nova página carregada após clique no link "${step.label.replace(/clicar no link/i,'').trim()}"${newPath ? '. URL alcançada: ' + newPath : ''}. Confirma redirecionamento correto${step.duration ? ' em ' + step.duration + 'ms' : ''}.`
                                        : lbl.includes('acessar') || lbl.includes('goto')
                                        ? `Screenshot da página renderizada${newPath ? ' (URL: ' + newPath + ')' : ''}. Conteúdo principal visível, carregamento confirmado${step.duration ? ' em ' + step.duration + 'ms' : ''}.`
                                        : lbl.includes('clicar')
                                        ? `Screenshot após clique${newPath ? ', URL resultante: ' + newPath : ''}. Ação executada${step.duration ? ' em ' + step.duration + 'ms' : ''}.`
                                        : `${step.detalhe || 'Passo concluído.'}${step.duration ? ' (' + step.duration + 'ms)' : ''}.`;

                                    return (
                                      <div key={step.index} className="rounded-xl border border-border bg-background/30 overflow-hidden">
                                        {/* Passo header */}
                                        <div className="flex items-center gap-3 px-4 py-3 bg-accent/20 border-b border-border">
                                          <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border", statusColor)}>
                                            {statusIcon} {statusTxt}
                                          </span>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Passo {idx + 1}</span>
                                          {step.duration && <span className="text-[10px] text-muted-foreground/60 ml-auto font-mono">⏱ {step.duration}ms</span>}
                                        </div>

                                        <div className="p-4 space-y-3">
                                          {/* Ação */}
                                          <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Ação Realizada</p>
                                            <p className="text-sm font-medium text-foreground">{step.label}</p>
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* Resultado esperado */}
                                            <div>
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Resultado Esperado</p>
                                              <p className="text-xs text-foreground/80 leading-relaxed">{resultadoEsperado}</p>
                                            </div>
                                            {/* Resultado obtido */}
                                            <div>
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Resultado Obtido</p>
                                              <p className="text-xs font-mono bg-accent/30 px-2 py-1.5 rounded-lg text-foreground/70 leading-relaxed break-all">{step.detalhe}</p>
                                            </div>
                                          </div>

                                          {/* Evidência funcional */}
                                          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Evidência Funcional</p>
                                            <p className="text-xs text-blue-100/70 leading-relaxed italic">{evidencia}</p>
                                          </div>

                                          {/* Screenshot */}
                                          {(step.screenshotBase64 || step.screenshotElementBase64) && (
                                            <div className="relative mt-3">
                                              {step.screenshotBase64 && (
                                                <img
                                                  src={`data:image/jpeg;base64,${step.screenshotBase64}`}
                                                  alt={`Evidência passo ${step.index}`}
                                                  className="rounded-lg border border-border w-full max-h-72 object-contain shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                                  onClick={() => window.open(`data:image/jpeg;base64,${step.screenshotBase64}`, '_blank')}
                                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                              )}
                                              {step.screenshotElementBase64 && (
                                                <img
                                                  src={`data:image/jpeg;base64,${step.screenshotElementBase64}`}
                                                  alt="Elemento interagido"
                                                  className="absolute bottom-4 right-4 max-w-[250px] max-h-[200px] border-2 border-red-500 rounded-md shadow-lg bg-white object-contain"
                                                />
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Botões do relatório */}
                                {(rj.htmlReportUrl || rj.pdfUrl) && (
                                  <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
                                    {rj.htmlReportUrl && (
                                      <a href={rj.htmlReportUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-violet-500/30 transition-all">
                                        <Eye className="w-3.5 h-3.5" /> Ver Relatório HTML
                                      </a>
                                    )}
                                    {rj.pdfUrl && (
                                      <a href={rj.pdfUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-violet-500/30 transition-all">
                                        <FileDown className="w-3.5 h-3.5" /> Baixar PDF
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
