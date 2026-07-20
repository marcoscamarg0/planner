"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Zap, Loader2, FileDown, Eye, CheckCircle2,
  AlertCircle, ChevronDown, Play, Sparkles, RefreshCw,
  Target, Shield, BarChart3, Clock, ArrowRight, List,
  Image as ImageIcon, X
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
    label: "Testar página inteira",
    value: "Acesse a página, aceite cookies se aparecer, role a página inteira para baixo verificando todos os elementos visíveis, clique nos links principais do menu de navegação e capture cada estado.",
  },
  {
    label: "Auditoria de acessibilidade",
    value: "Acesse a URL, verifique se todos os botões possuem texto acessível, navegue pelas seções principais da página e verifique a estrutura de headings e links.",
  },
  {
    label: "Fluxo de login",
    value: "Acesse a página de login, preencha o campo de email com 'teste@exemplo.com', preencha a senha com 'Senha123', clique no botão de entrar e verifique se o login foi realizado.",
  },
  {
    label: "Navegação do menu",
    value: "Acesse a homepage, clique em cada item do menu principal e verifique se as páginas carregam corretamente. Volte para a home entre cada item.",
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
export function SmartRunnerTab({ initialReport }: { initialReport?: RunResult | null }) {
  const [targetUrl, setTargetUrl]         = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [jobName, setJobName]             = useState("");
  const [model, setModel]                 = useState("auto-free");
  const [includeAxe, setIncludeAxe]       = useState(true);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const [phase, setPhase]         = useState<RunPhase>("idle");
  const [result, setResult]       = useState<RunResult | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [currentPhaseMsg, setCurrentPhaseMsg] = useState("");
  const [elapsed, setElapsed]     = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [showGenerated, setShowGenerated] = useState(false);

  const [contextImages, setContextImages] = useState<string[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Initialize with history report if provided
  useEffect(() => {
    if (initialReport) {
      setResult(initialReport);
      setTargetUrl(initialReport.targetUrl || "");
      setJobName(initialReport.jobName || "");
      setPhase("done");
      setShowSteps(true);
    }
  }, [initialReport]);

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
    "Analisando URL e gerando passos via IA...",
    "Iniciando navegador headless...",
    "Executando automação no site...",
    "Capturando evidências de cada passo...",
    "Rodando auditoria de acessibilidade (eMAG)...",
    "Gerando relatório PDF...",
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
      }
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      setIsProcessingFile(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRun = async () => {
    if (!targetUrl.trim() || !flowDescription.trim()) return;
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
      const res = await fetch("/api/automation/smart-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          flowDescription: flowDescription.trim(),
          jobName: jobName.trim() || undefined,
          model,
          includeAxe,
          contextImages,
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error("Erro no servidor (a resposta não é um JSON válido). O processo pode ter estourado a memória ou o limite de tempo no Render. Resposta: " + text.substring(0, 100));
      }

      if (!res.ok) throw new Error(data.error || "Falha na execução");

      setResult(data);
      setPhase("done");
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
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

      {/* ── Hero Header ──────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" />
          Runner Inteligente
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Teste qualquer site com IA
        </h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Cole a URL e descreva o fluxo que quer testar. A IA gera o script Playwright, executa no servidor e te entrega um PDF completo com evidências de cada passo.
        </p>
      </div>

      {/* ── Formulário ──────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === "idle" || phase === "error") && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl border border-border p-6 space-y-5"
          >
            {/* URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                URL do Site
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  placeholder="https://www.exemplo.gov.br"
                  className="w-full pl-9 pr-4 py-3 rounded-xl bg-background/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
                />
              </div>
            </div>

            {/* Nome do relatório (opcional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Nome do Relatório <span className="text-muted-foreground/60 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={jobName}
                onChange={e => setJobName(e.target.value)}
                placeholder="Ex: Auditoria CDT Gov.br"
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
              />
            </div>

            {/* Fluxo de teste */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Descreva o Fluxo que Quer Testar
                </label>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {FLOW_EXAMPLES.map(ex => (
                    <button
                      key={ex.label}
                      onClick={() => setFlowDescription(ex.value)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-all"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={flowDescription}
                onChange={e => setFlowDescription(e.target.value)}
                rows={4}
                placeholder={`Descreva o que quer testar em linguagem natural. Exemplos:\n\n• Acesse a página, aceite cookies, role a tela e clique nos botões principais\n• Teste o fluxo de login com email e senha\n• Verifique se o menu de navegação funciona corretamente`}
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition-all resize-none font-sans"
              />
              
              {/* Image/PDF Upload */}
              <div className="pt-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFile}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-violet-500/30 transition-all disabled:opacity-50"
                >
                  {isProcessingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  Anexar Tela ou PDF (Opcional)
                </button>
                {contextImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {contextImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Context ${idx}`} className="h-16 w-16 object-cover rounded-lg border border-border shadow-sm" />
                        <button
                          onClick={() => setContextImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-background border border-border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Opções */}

            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Modelo */}
              <div className="relative">
                <button
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border text-sm hover:border-violet-500/40 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span className="font-medium text-foreground">{currentModel.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">
                    {currentModel.badge}
                  </span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showModelMenu && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {showModelMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      className="absolute left-0 mt-2 w-72 rounded-xl glass border border-border shadow-2xl z-50 overflow-hidden"
                    >
                      {MODELS.map(m => (
                        <button
                          key={m.key}
                          onClick={() => { setModel(m.key); setShowModelMenu(false); }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-accent/50 transition-colors",
                            model === m.key && "bg-primary/10 text-primary"
                          )}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.provider} · {m.badge}</p>
                          </div>
                          {model === m.key && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
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
                disabled={!targetUrl.trim() || !flowDescription.trim()}
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

      {/* ── Tela de Progresso ──────────────────────────────── */}
      <AnimatePresence>
        {phase === "running" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="glass rounded-2xl border border-violet-500/30 p-8 text-center space-y-6"
          >
            {/* Spinner animado */}
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-violet-500/30 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-8 h-8 text-violet-400" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">Executando Automação</p>
              <p className="text-sm text-violet-400 animate-pulse">{currentPhaseMsg}</p>
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              {formatTime(elapsed)} decorridos
            </div>

            {/* Steps de progresso visual */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[
                { icon: Globe,     label: "Acessando URL" },
                { icon: Sparkles,  label: "IA Gerando Passos" },
                { icon: Play,      label: "Executando" },
                { icon: Shield,    label: "Auditoria eMAG" },
                { icon: FileDown,  label: "Gerando PDF" },
              ].map((s, i) => {
                const Icon = s.icon;
                const isActive = Math.floor(elapsed / 8) === i;
                const isDone   = Math.floor(elapsed / 8) > i;
                return (
                  <div key={i} className="flex items-center gap-1">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center border transition-all",
                      isDone  ? "bg-emerald-500/20 border-emerald-500/40" :
                      isActive? "bg-violet-500/20 border-violet-500/40 animate-pulse" :
                               "bg-muted/30 border-border"
                    )}>
                      {isDone
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        : <Icon className={cn("w-3.5 h-3.5", isActive ? "text-violet-400" : "text-muted-foreground")} />
                      }
                    </div>
                    {i < 4 && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              Isso pode levar 1–3 minutos dependendo do site e número de passos.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Resultado ──────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "done" && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Status header */}
            <div className="glass rounded-2xl border border-emerald-500/30 p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{result.jobName}</p>
                  <p className="text-xs text-muted-foreground">{result.targetUrl} · {formatTime(elapsed)} de execução</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {result.pdfUrl && (
                  <a
                    href={result.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 transition-all shadow-lg shadow-violet-500/25"
                  >
                    <FileDown className="w-4 h-4" />
                    Baixar PDF
                  </a>
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

            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total de Passos", value: result.totalSteps,          color: "text-primary",    bg: "bg-primary/10",    icon: Target },
                { label: "Aprovados",       value: result.approvedSteps,       color: "text-emerald-400",bg: "bg-emerald-400/10",icon: CheckCircle2 },
                { label: "Falhas",          value: result.failedSteps,         color: "text-rose-400",   bg: "bg-rose-400/10",   icon: AlertCircle },
                { label: "Violações eMAG",  value: result.axeViolationsCount,  color: "text-amber-400",  bg: "bg-amber-400/10",  icon: Shield },
              ].map(m => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className={cn("rounded-xl p-4 text-center border border-border/50", m.bg)}>
                    <Icon className={cn("w-5 h-5 mx-auto mb-2", m.color)} />
                    <p className={cn("text-2xl font-bold", m.color)}>{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{m.label}</p>
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
                          {step.screenshotBase64 && (
                            <div className="mt-3 ml-9">
                              <img
                                src={`data:image/png;base64,${step.screenshotBase64}`}
                                alt={`Evidência passo ${step.index}`}
                                className="rounded-lg border border-border max-h-48 object-contain shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => window.open(`data:image/png;base64,${step.screenshotBase64}`, "_blank")}
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

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
