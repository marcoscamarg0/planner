"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Upload, X, Sparkles, Loader2, Download, Copy, Check,
  FileCode, FileText, Package, AlertCircle, CheckCircle2,
  ChevronDown, Code2, History, RefreshCw, ChevronRight, Link,
  Zap, Terminal, Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MODELS = [
  { key: "kimi-k2", label: "Kimi K2", provider: "Moonshot AI", badge: "★ Recomendado" },
  { key: "auto-free", label: "Automático", provider: "OpenRouter", badge: "Gratuito" },
  { key: "qwen-coder", label: "Qwen 2.5 Coder", provider: "Alibaba", badge: "Código" },
  { key: "nemotron-70b", label: "Nemotron 70B", provider: "Nvidia", badge: "Avançado" },
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
}

interface GeneratedResult {
  script: string;
  packageJson: any;
  report: string;
  pageTitle: string;
  framework: string;
  elementsFound: number;
}

type ResultTab = "script" | "package" | "report";

export function AutoWebTab() {
  const [mode, setMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [projectName, setProjectName] = useState("meu-projeto-teste");
  const [framework, setFramework] = useState("playwright");
  const [model, setModel] = useState("kimi-k2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("script");
  const [copied, setCopied] = useState<string | null>(null);
  const [showModelMenu, setShowModelMenu] = useState(false);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [reports, setReports] = useState<AutoWebReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AutoWebReport | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const currentModel = MODELS.find(m => m.key === model) || MODELS[0];
  const currentFw = FRAMEWORKS.find(f => f.key === framework) || FRAMEWORKS[0];

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
      setResultTab("script");
    } catch (e: any) {
      setError(e.message || "Erro inesperado");
    } finally {
      setLoading(false);
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
    // Download each file separately since we can't use JSZip without install
    const fw = result.framework.toLowerCase();
    const ext = fw === "selenium" ? "py" : fw === "cypress" ? "js" : "ts";
    const filename = fw === "selenium" ? "test_automation.py"
      : fw === "cypress" ? "cypress/e2e/automation.cy.js"
      : "tests/automation.spec.ts";

    download(result.script, filename);
    setTimeout(() => download(JSON.stringify(result.packageJson, null, 2), "package.json"), 300);
    setTimeout(() => download(result.report, "RELATORIO.md"), 600);
  };

  const ext = framework === "selenium" ? "py" : framework === "cypress" ? "js" : "ts";
  const scriptFilename = framework === "selenium" ? "test_automation.py"
    : framework === "cypress" ? "automation.cy.js"
    : "automation.spec.ts";

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
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadReports(); }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all shrink-0",
              showHistory ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            <History className="w-4 h-4" />
            Histórico
          </button>
        </div>
      </div>

      {/* History Panel */}
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
                  <span className="text-sm font-semibold">Automações Geradas</span>
                  <span className="text-xs text-muted-foreground">({reports.length})</span>
                </div>
                <button onClick={loadReports} className="text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              {loadingReports ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : reports.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">Nenhuma automação gerada ainda.</p>
              ) : (
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {reports.map(r => (
                    <button key={r.id} onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}
                      className={cn("w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-accent/50 transition-colors", selectedReport?.id === r.id && "bg-primary/5")}
                    >
                      <Globe className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.source_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")} · {r.framework} · {r.model_used}
                        </p>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", selectedReport?.id === r.id && "rotate-90")} />
                    </button>
                  ))}
                </div>
              )}
              {selectedReport && (
                <div className="border-t border-border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{selectedReport.source_name}</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => download(selectedReport.script_content,
                        selectedReport.framework === "selenium" ? "test_automation.py" : selectedReport.framework === "cypress" ? "automation.cy.js" : "automation.spec.ts")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground transition-all">
                        <Download className="w-3.5 h-3.5" /> Script
                      </button>
                      <button onClick={() => download(JSON.stringify(selectedReport.package_json, null, 2), "package.json")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground transition-all">
                        <Package className="w-3.5 h-3.5" /> package.json
                      </button>
                      <button onClick={() => setSelectedReport(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs text-foreground bg-black/20 rounded-xl p-4 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                    {selectedReport.script_content}
                  </pre>
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

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Stats bar */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold", currentFw.bg, currentFw.color, "border", currentFw.border)}>
                <Code2 className="w-4 h-4" />
                {currentFw.label} · {currentFw.lang}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-primary/10 text-primary">
                <CheckCircle2 className="w-4 h-4" />
                {result.elementsFound} elementos encontrados
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-emerald-400/10 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Salvo automaticamente
              </div>
              <button onClick={downloadZip}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-all">
                <Download className="w-4 h-4" />
                Baixar Tudo (3 arquivos)
              </button>
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
              <div className="flex border-b border-border">
                {[
                  { key: "script" as ResultTab, label: scriptFilename, icon: FileCode },
                  { key: "package" as ResultTab, label: "package.json", icon: Package },
                  { key: "report" as ResultTab, label: "RELATORIO.md", icon: FileText },
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.key} onClick={() => setResultTab(t.key)}
                      className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                        resultTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-4">
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
                  {resultTab === "report" && (
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
                  {resultTab === "report" && result.report}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
