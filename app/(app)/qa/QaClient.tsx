"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
  FileText,
  Code2,
  Sparkles,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MODELS = [
  { key: "llama-3.1-8b", label: "Llama 3.1 8B", provider: "Meta", badge: "Rápido" },
  { key: "gemini-flash", label: "Gemini Flash 1.5", provider: "Google", badge: "Respostas ricas" },
  { key: "mistral-7b", label: "Mistral 7B", provider: "Mistral", badge: "Código" },
  { key: "claude-haiku", label: "Claude 3 Haiku", provider: "Anthropic", badge: "Preciso" },
  { key: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", badge: "Premium" },
];

const FRAMEWORKS = [
  { key: "playwright", label: "Playwright", lang: "TypeScript" },
  { key: "cypress", label: "Cypress", lang: "JavaScript" },
  { key: "selenium", label: "Selenium", lang: "Python" },
];

const PRIORITY_COLOR: Record<string, string> = {
  alta: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  media: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  baixa: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  happy_path: CheckCircle2,
  error: AlertCircle,
  edge_case: AlertTriangle,
};

const CATEGORY_LABEL: Record<string, string> = {
  happy_path: "Happy Path",
  error: "Caso de Erro",
  edge_case: "Caso de Borda",
};

const CATEGORY_COLOR: Record<string, string> = {
  happy_path: "text-emerald-400",
  error: "text-rose-400",
  edge_case: "text-amber-400",
};

interface Project {
  id: string;
  title: string;
}

interface TestCase {
  id: string;
  title: string;
  category: string;
  steps: string[];
  expected_result: string;
  priority: string;
}

type ToolTab = "test_cases" | "test_report" | "automation";

interface QaClientProps {
  projects: Project[];
}

export function QaClient({ projects }: QaClientProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>("test_cases");
  const [selectedModel, setSelectedModel] = useState(MODELS[0].key);
  const [selectedFramework, setSelectedFramework] = useState(FRAMEWORKS[0].key);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [testCases, setTestCases] = useState<TestCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const currentModel = MODELS.find(m => m.key === selectedModel) || MODELS[0];

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult(null);
    setTestCases(null);
    setError(null);

    try {
      const res = await fetch("/api/ai/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_type: activeTab,
          input: input.trim(),
          framework: selectedFramework,
          model: selectedModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na geração");

      if (activeTab === "test_cases") {
        try {
          const jsonStr = data.result.replace(/```json\n?|\n?```/g, "").trim();
          const parsed = JSON.parse(jsonStr);
          setTestCases(parsed.test_cases || []);
        } catch {
          setResult(data.result);
        }
      } else {
        setResult(data.result);
      }
    } catch (e: any) {
      setError(e.message || "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadResult = (text: string, ext: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qa-output." + ext;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTestCasesAsMarkdown = () => {
    if (!testCases) return;
    let md = "# Casos de Teste\n\n";
    testCases.forEach(tc => {
      md += "## " + tc.id + " — " + tc.title + "\n";
      md += "- **Categoria:** " + CATEGORY_LABEL[tc.category] + "\n";
      md += "- **Prioridade:** " + tc.priority.toUpperCase() + "\n\n";
      md += "**Passos:**\n";
      tc.steps.forEach((s, i) => { md += (i + 1) + ". " + s + "\n"; });
      md += "\n**Resultado Esperado:** " + tc.expected_result + "\n\n---\n\n";
    });
    downloadResult(md, "md");
  };

  const tabs = [
    { key: "test_cases" as ToolTab, label: "Casos de Teste", icon: FlaskConical, desc: "Gere suítes de teste a partir de um requisito ou funcionalidade" },
    { key: "test_report" as ToolTab, label: "Relatório de Teste", icon: FileText, desc: "Documente resultados em um relatório profissional" },
    { key: "automation" as ToolTab, label: "Automação", icon: Code2, desc: "Gere scripts prontos para Playwright, Cypress ou Selenium" },
  ];

  const PLACEHOLDERS: Record<ToolTab, string> = {
    test_cases: "Descreva a funcionalidade a ser testada...\n\nExemplo: Tela de login com e-mail e senha. O usuário pode recuperar a senha. Após 5 tentativas erradas, a conta é bloqueada por 10 minutos.",
    test_report: "Descreva o que foi testado e os resultados encontrados...\n\nExemplo: Testamos o fluxo de login. 2 bugs críticos foram encontrados: tela branca ao tentar login com e-mail inválido e botão de recuperação sem feedback visual.",
    automation: "Descreva o fluxo a ser automatizado...\n\nExemplo: Login bem-sucedido com credenciais válidas, verificando redirecionamento para o dashboard e exibição do nome do usuário.",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card/50">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Qualidade & Testes</h1>
              <p className="text-xs text-muted-foreground">Suite de ferramentas QA alimentada por IA</p>
            </div>
          </div>

          {/* Model Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border text-sm hover:border-primary/40 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">{currentModel.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{currentModel.provider}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            <AnimatePresence>
              {showModelMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute right-0 mt-2 w-72 rounded-xl glass border border-border shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selecionar Modelo de IA</p>
                  </div>
                  {MODELS.map(m => (
                    <button
                      key={m.key}
                      onClick={() => { setSelectedModel(m.key); setShowModelMenu(false); }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent transition-colors",
                        selectedModel === m.key && "bg-primary/10"
                      )}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-foreground">{m.label}</span>
                        <span className="text-[11px] text-muted-foreground">{m.provider}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">{m.badge}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tool Tabs */}
        <div className="flex gap-2 mt-5 flex-wrap">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setResult(null); setTestCases(null); setError(null); }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                  activeTab === t.key
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "glass text-muted-foreground hover:text-foreground border border-border"
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {/* Input Area */}
          <div className="glass rounded-2xl border border-border p-5 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                {tabs.find(t => t.key === activeTab)?.desc}
              </p>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={PLACEHOLDERS[activeTab]}
                rows={6}
                className="w-full bg-black/10 dark:bg-black/30 text-foreground placeholder:text-muted-foreground/60 rounded-xl p-4 text-sm outline-none border border-border/50 resize-y focus:border-primary/50 transition-colors leading-relaxed"
              />
            </div>

            {/* Framework selector (automation only) */}
            <AnimatePresence>
              {activeTab === "automation" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 flex-wrap"
                >
                  <span className="text-xs text-muted-foreground font-medium">Framework:</span>
                  {FRAMEWORKS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setSelectedFramework(f.key)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        selectedFramework === f.key
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                      )}
                    >
                      <Code2 className="w-3 h-3" />
                      {f.label}
                      <span className="text-[10px] opacity-60">{f.lang}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {loading ? "Gerando..." : "Gerar com IA"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="glass rounded-xl border border-rose-500/30 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}

          {/* Test Cases Result */}
          <AnimatePresence>
            {testCases && testCases.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">{testCases.length} casos de teste gerados</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportTestCasesAsMarkdown}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar .MD
                    </button>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(testCases, null, 2))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copiado!" : "Copiar JSON"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {testCases.map((tc) => {
                    const CatIcon = CATEGORY_ICON[tc.category] || AlertCircle;
                    return (
                      <motion.div
                        key={tc.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass rounded-xl border border-border p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <CatIcon className={cn("w-4 h-4 shrink-0", CATEGORY_COLOR[tc.category])} />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{tc.id}</span>
                            <h3 className="text-sm font-semibold text-foreground">{tc.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", PRIORITY_COLOR[tc.priority] || PRIORITY_COLOR["media"])}>
                              {tc.priority}
                            </span>
                            <span className="text-[10px] text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                              {CATEGORY_LABEL[tc.category]}
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Passos</p>
                          <ol className="space-y-1">
                            {tc.steps.map((step, si) => (
                              <li key={si} className="flex items-start gap-2.5 text-sm text-foreground">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{si + 1}</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>

                        <div className="pt-2 border-t border-border/50">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Resultado Esperado</p>
                          <p className="text-sm text-emerald-400">{tc.expected_result}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text/Code Result (reports & automation) */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {activeTab === "test_report" ? (
                      <FileText className="w-4 h-4 text-primary" />
                    ) : (
                      <Code2 className="w-4 h-4 text-primary" />
                    )}
                    <h2 className="text-sm font-semibold text-foreground">
                      {activeTab === "test_report" ? "Relatório Gerado" : "Script de Automação"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadResult(result, activeTab === "test_report" ? "md" : activeTab === "automation" && selectedFramework === "selenium" ? "py" : "ts")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar
                    </button>
                    <button
                      onClick={() => copyToClipboard(result)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>

                <div className={cn(
                  "glass rounded-xl border border-border overflow-hidden",
                )}>
                  <pre className="p-5 text-xs leading-relaxed text-foreground overflow-x-auto whitespace-pre-wrap font-mono">
                    {result}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
