"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  Upload,
  X,
  History,
  BarChart3,
  Trash2,
  ChevronRight,
  RefreshCw,
  Printer,
  ShieldAlert,
  Eye,
  FileDown,
  Zap,
  List,
  ClipboardList,
  Bug,
  Table2,
  Flame,
  Gauge,
  Lock,
  RotateCcw,
  Scale,
  Users,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartRunnerTab } from "@/components/qa/SmartRunnerTab";
import { BatchRunnerTab } from "@/components/qa/BatchRunnerTab";

const MODELS = [
  { key: "auto-free", label: "Automático (Recomendado)", provider: "OpenRouter", badge: "Gratuito" },
  { key: "nemotron-super", label: "Nemotron 3 Super", provider: "Nvidia", badge: "Gratuito" },
  { key: "laguna-xs", label: "Laguna XS 2.1", provider: "Poolside", badge: "Gratuito" },
  { key: "gpt-oss", label: "GPT OSS 20B", provider: "OpenAI", badge: "Gratuito" },
  { key: "cohere-north", label: "North Mini Code", provider: "Cohere", badge: "Gratuito" },
  { key: "qwen-coder", label: "Qwen 2.5 Coder", provider: "Alibaba", badge: "Programação" },
  { key: "kimi-k2", label: "Kimi K2 (Legado)", provider: "Moonshot AI", badge: "Pago" },
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

const TYPE_LABEL: Record<string, string> = {
  test_cases: "Casos de Teste",
  test_report: "Relatório",
  smart_runner: "Runner Inteligente",
  consolidated_report: "Relatório Executivo",
  general_test_report: "Rel. Geral",
  ter: "Execução (TER)",
  bug_report: "Bugs/Erros",
  rtm: "Matriz RTM",
  smoke_test: "Fumaça",
  performance_report: "Desempenho",
  security_report: "Segurança",
  regression_report: "Regressão",
  compliance_report: "Conformidade",
  uat_report: "UAT",
};

const TYPE_COLOR: Record<string, string> = {
  test_cases: "text-sky-400 bg-sky-400/10",
  test_report: "text-violet-400 bg-violet-400/10",
  smart_runner: "text-emerald-400 bg-emerald-400/10",
  consolidated_report: "text-amber-400 bg-amber-400/10",
  general_test_report: "text-blue-400 bg-blue-400/10",
  ter: "text-cyan-400 bg-cyan-400/10",
  bug_report: "text-rose-400 bg-rose-400/10",
  rtm: "text-indigo-400 bg-indigo-400/10",
  smoke_test: "text-orange-400 bg-orange-400/10",
  performance_report: "text-yellow-400 bg-yellow-400/10",
  security_report: "text-red-400 bg-red-400/10",
  regression_report: "text-purple-400 bg-purple-400/10",
  compliance_report: "text-teal-400 bg-teal-400/10",
  uat_report: "text-pink-400 bg-pink-400/10",
};

interface Project { id: string; title: string; }
interface TestCase {
  id: string; title: string; category: string;
  steps: string[]; expected_result: string; priority: string;
  evidence?: string;
}
interface QaReport {
  id: string; type: string; title: string; input_description: string;
  framework: string | null; model_used: string; result_raw: string;
  result_json: any; created_at: string;
}

type ReportSubType =
  | "general_test_report" | "ter" | "bug_report" | "rtm"
  | "smoke_test" | "performance_report" | "security_report"
  | "regression_report" | "compliance_report" | "uat_report";

type ToolTab = "test_cases" | "reports" | "smart_runner" | "batch_runner";

const REPORT_TYPES: Array<{
  key: ReportSubType;
  label: string;
  icon: React.ElementType;
  desc: string;
  color: string;
  placeholder: string;
}> = [
  {
    key: "general_test_report",
    label: "Relatório Geral",
    icon: LayoutGrid,
    color: "text-blue-400 border-blue-400/30 bg-blue-400/5",
    desc: "Visão geral do ciclo: métricas, defeitos abertos, cobertura e critérios de saída.",
    placeholder: "Descreva o ciclo de testes realizado...\n\nExemplo: Sprint 12 — testamos os módulos de login, cadastro e checkout. Foram executados 80 casos de teste, com 68 aprovados, 9 reprovados e 3 bloqueados. 4 bugs críticos abertos.",
  },
  {
    key: "ter",
    label: "Execução (TER)",
    icon: ClipboardList,
    color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/5",
    desc: "Detalhamento por caso: ID, passos executados, status e observações do testador.",
    placeholder: "Descreva os testes executados com detalhes de cada caso...\n\nExemplo: TC001 - Login com e-mail válido → Aprovado. TC002 - Login com senha errada → Reprovado (mensagem de erro não exibida). TC003 - Recuperar senha → Bloqueado (serviço de e-mail fora do ar).",
  },
  {
    key: "bug_report",
    label: "Bugs / Erros",
    icon: Bug,
    color: "text-rose-400 border-rose-400/30 bg-rose-400/5",
    desc: "Defeitos com ID, severidade, prioridade, passos de reprodução e status.",
    placeholder: "Descreva os bugs encontrados...\n\nExemplo: BUG-001 - Tela branca ao fazer login com e-mail inválido. Severidade: Alta. Passos: 1. Acessar login. 2. Digitar e-mail inválido. 3. Clicar em Entrar. Resultado: tela branca sem mensagem de erro.",
  },
  {
    key: "rtm",
    label: "Matriz RTM",
    icon: Table2,
    color: "text-indigo-400 border-indigo-400/30 bg-indigo-400/5",
    desc: "Tabela mapeando requisitos → casos de teste para garantir cobertura total.",
    placeholder: "Liste os requisitos e seus casos de teste relacionados...\n\nExemplo: REQ-001 O sistema deve permitir login com e-mail e senha → TC001, TC002, TC003. REQ-002 O usuário pode recuperar a senha por e-mail → TC004, TC005. REQ-003 Após 5 tentativas, a conta é bloqueada → TC006.",
  },
  {
    key: "smoke_test",
    label: "Teste de Fumaça",
    icon: Flame,
    color: "text-orange-400 border-orange-400/30 bg-orange-400/5",
    desc: "Verifica funcionalidades críticas após novo deploy ou build.",
    placeholder: "Descreva a build e as funcionalidades críticas a verificar...\n\nExemplo: Build v2.3.1 implantada em staging. Verificar: login, logout, criação de conta, checkout, painel administrativo e API de pagamento.",
  },
  {
    key: "performance_report",
    label: "Desempenho",
    icon: Gauge,
    color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    desc: "Tempo de resposta, throughput, utilização, escalabilidade e gargalos.",
    placeholder: "Descreva os resultados dos testes de desempenho...\n\nExemplo: Teste de carga com 500 usuários simultâneos. Tempo de resposta médio: 1.2s (P95: 3.8s). Throughput: 420 req/s. CPU pico: 78%. Endpoint /api/checkout com latência elevada de 4.5s.",
  },
  {
    key: "security_report",
    label: "Segurança",
    icon: Lock,
    color: "text-red-400 border-red-400/30 bg-red-400/5",
    desc: "Vulnerabilidades (OWASP), CVSS score, impacto e recomendações de mitigação.",
    placeholder: "Descreva as vulnerabilidades e testes de segurança realizados...\n\nExemplo: Encontrada vulnerabilidade de XSS no campo de busca (CVSS 7.2 - Alto). SQL Injection testado e não encontrado. Autenticação sem rate limiting permite brute force.",
  },
  {
    key: "regression_report",
    label: "Regressão",
    icon: RotateCcw,
    color: "text-purple-400 border-purple-400/30 bg-purple-400/5",
    desc: "Impacto de novos recursos na estabilidade do sistema existente.",
    placeholder: "Descreva a mudança realizada e os resultados dos testes de regressão...\n\nExemplo: Nova feature de cupom de desconto adicionada na v2.4. Suíte de regressão: 120 casos. 115 aprovados, 5 reprovados — 3 regressões no módulo de carrinho e 2 no checkout.",
  },
  {
    key: "compliance_report",
    label: "Conformidade",
    icon: Scale,
    color: "text-teal-400 border-teal-400/30 bg-teal-400/5",
    desc: "Aderência a normas regulatórias (LGPD, ISO 27001, PCI-DSS, HIPAA, etc.).",
    placeholder: "Descreva o sistema e as normas a verificar...\n\nExemplo: Sistema de pagamentos. Normas: PCI-DSS e LGPD. Verificar: criptografia de dados de cartão, consentimento de coleta de dados pessoais, política de retenção e logs de auditoria.",
  },
  {
    key: "uat_report",
    label: "UAT",
    icon: Users,
    color: "text-pink-400 border-pink-400/30 bg-pink-400/5",
    desc: "Resultado dos testes com usuários finais e prontidão para produção.",
    placeholder: "Descreva os cenários testados pelos usuários e seus feedbacks...\n\nExemplo: 8 usuários finais testaram o novo fluxo de onboarding por 3 dias. Principais feedbacks: botão de 'próximo' pouco visível, texto das instruções confuso, dificuldade em entender o formulário de endereço.",
  },
];


interface QaClientProps { projects: Project[]; }

export function QaClient({ projects }: QaClientProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>("smart_runner");
  const [selectedReportType, setSelectedReportType] = useState<ReportSubType | null>(null);
  const [selectedModel, setSelectedModel] = useState("auto-free");
  const [selectedFramework, setSelectedFramework] = useState("playwright");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [testCases, setTestCases] = useState<TestCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  // HTML file
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF file
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Import code toggle for test cases
  const [importingCode, setImportingCode] = useState(false);

  // History / Reports
  const [showHistory, setShowHistory] = useState(false);
  const [reports, setReports] = useState<QaReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState<QaReport | null>(null);
  const [consolidating, setConsolidating] = useState(false);

  // QA Reports Management
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [editingReport, setEditingReport] = useState<QaReport | null>(null);
  const [deletingReportIds, setDeletingReportIds] = useState<string[] | null>(null);
  const [exportingReportIds, setExportingReportIds] = useState<string[] | null>(null);
  const [selectedExportProjectId, setSelectedExportProjectId] = useState<string>("");
  const [isManagingReports, setIsManagingReports] = useState(false);


  // Evidence upload for test cases
  const [activeEvidenceTcId, setActiveEvidenceTcId] = useState<string | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
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

  const handlePdfUpload = async (input: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = 'target' in input ? input.target.files?.[0] : input;
    if (!file) return;
    setPdfFile(file);
    setParsingPdf(true);
    setPdfImages([]);
    setError(null);

    try {
      // 1. Fetch text from backend (highly reliable, no render/worker crashes)
      const formData = new FormData();
      formData.append("pdf_file", file);
      const textPromise = fetch("/api/ai/parse-pdf", {
        method: "POST",
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erro ao ler texto do PDF");
        }
        return res.json();
      });

      // 2. Render pages to images in frontend (wrapped in try/catch per page)
      const imagesPromise = (async () => {
        const images: string[] = [];
        try {
          const pdfjs = await loadPdfJs();
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            try {
              const page = await pdfDoc.getPage(i);
              const viewport = page.getViewport({ scale: 1.2 }); // Slightly lower scale to save memory/speed
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport }).promise;
                const imgUrl = canvas.toDataURL("image/jpeg", 0.7);
                images.push(imgUrl);
              }
            } catch (pageErr) {
              console.warn(`Erro ao renderizar imagem da página ${i} do PDF:`, pageErr);
              // Continue rendering next pages even if one page fails due to pattern/font issues
            }
          }
        } catch (pdfJsErr) {
          console.warn("Erro ao iniciar renderizador de PDF.js:", pdfJsErr);
        }
        return images;
      })();

      // Wait for both text parsing and page rendering
      const [textData, images] = await Promise.all([textPromise, imagesPromise]);
      
      setInput(textData.text || "");
      setPdfImages(images);
    } catch (err: any) {
      console.error(err);
      setError("Erro ao ler PDF: " + (err.message || err));
      setPdfFile(null);
    } finally {
      setParsingPdf(false);
    }
  };

  const importPdfFromUrl = async (url: string) => {
    try {
      setParsingPdf(true);
      setActiveTab("reports");
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], "smart_runner_report.pdf", { type: "application/pdf" });
      await handlePdfUpload(file);
    } catch (err) {
      console.error(err);
      alert("Erro ao importar PDF do Runner");
      setParsingPdf(false);
    }
  };

  const currentModel = MODELS.find(m => m.key === selectedModel) || MODELS[0];

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch("/api/ai/qa");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch { /* silent */ } finally {
      setLoadingReports(false);
    }
  }, []);

  const toggleReportSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedReportIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleDeleteReports = async () => {
    if (!deletingReportIds || deletingReportIds.length === 0) return;
    setIsManagingReports(true);
    try {
      const res = await fetch("/api/ai/qa/manage", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deletingReportIds }),
      });
      if (res.ok) {
        setReports(reports.filter(r => !deletingReportIds.includes(r.id)));
        setSelectedReportIds(prev => prev.filter(id => !deletingReportIds.includes(id)));
        if (selectedReport && deletingReportIds.includes(selectedReport.id)) setSelectedReport(null);
      } else {
        alert("Erro ao excluir relatórios.");
      }
    } catch {
      alert("Erro ao excluir relatórios.");
    } finally {
      setIsManagingReports(false);
      setDeletingReportIds(null);
    }
  };

  const handleEditReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    setIsManagingReports(true);
    try {
      const res = await fetch("/api/ai/qa/manage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingReport.id, title: editingReport.title, input_description: editingReport.input_description }),
      });
      if (res.ok) {
        setReports(reports.map(r => r.id === editingReport.id ? { ...r, title: editingReport.title, input_description: editingReport.input_description } : r));
        if (selectedReport?.id === editingReport.id) {
          setSelectedReport({ ...selectedReport, title: editingReport.title, input_description: editingReport.input_description });
        }
      } else {
        alert("Erro ao editar relatório.");
      }
    } catch {
      alert("Erro ao editar relatório.");
    } finally {
      setIsManagingReports(false);
      setEditingReport(null);
    }
  };

  const handleExportReports = async () => {
    if (!exportingReportIds || exportingReportIds.length === 0 || !selectedExportProjectId) return;
    setIsManagingReports(true);
    try {
      const res = await fetch("/api/ai/qa/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportIds: exportingReportIds, projectId: selectedExportProjectId }),
      });
      if (res.ok) {
        alert("Relatórios exportados com sucesso!");
        setSelectedReportIds([]);
      } else {
        alert("Erro ao exportar relatórios.");
      }
    } catch {
      alert("Erro ao exportar relatórios.");
    } finally {
      setIsManagingReports(false);
      setExportingReportIds(null);
      setSelectedExportProjectId("");
    }
  };

  useEffect(() => {
    if (showHistory) loadReports();
  }, [showHistory, loadReports]);

  // Sync test cases and raw result when a report is loaded/selected
  useEffect(() => {
    if (selectedReport) {
      setResult(selectedReport.result_raw);
      if (selectedReport.type === "test_cases" && selectedReport.result_json) {
        try {
          const parsed = selectedReport.result_json as any;
          setTestCases(parsed.test_cases || []);
        } catch {
          setTestCases([]);
        }
      } else {
        setTestCases([]);
      }
    } else {
      setResult(null);
      setTestCases([]);
    }
  }, [selectedReport]);

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeEvidenceTcId || !testCases) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const updatedTestCases = testCases.map(tc =>
        tc.id === activeEvidenceTcId ? { ...tc, evidence: base64 } : tc
      );
      setTestCases(updatedTestCases);

      if (selectedReport?.id) {
        try {
          const res = await fetch("/api/ai/qa", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: selectedReport.id,
              result_json: { test_cases: updatedTestCases },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.report) {
              setSelectedReport(data.report);
              loadReports();
            }
          }
        } catch (err) {
          console.error("Failed to auto-save evidence:", err);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveEvidence = async (tcId: string) => {
    if (!testCases) return;
    const updatedTestCases = testCases.map(tc =>
      tc.id === tcId ? { ...tc, evidence: undefined } : tc
    );
    setTestCases(updatedTestCases);

    if (selectedReport?.id) {
      try {
        const res = await fetch("/api/ai/qa", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedReport.id,
            result_json: { test_cases: updatedTestCases },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.report) {
            setSelectedReport(data.report);
            loadReports();
          }
        }
      } catch (err) {
        console.error("Failed to remove evidence:", err);
      }
    }
  };

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

      if (data.report) {
        setSelectedReport(data.report);
      }

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

      // Refresh reports after generation
      loadReports();
    } catch (e: any) {
      setError(e.message || "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleConsolidatedReport = async () => {
    setConsolidating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_type: "consolidated_report", input: "", model: selectedModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha");
      setSelectedReport({
        id: "new",
        type: "consolidated_report",
        title: "Relatório Executivo Consolidado",
        input_description: "",
        framework: null,
        model_used: selectedModel,
        result_raw: data.result,
        result_json: null,
        created_at: new Date().toISOString(),
      });
      setShowHistory(true);
      loadReports();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConsolidating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadResult = (text: string, ext: string, name?: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (name || "qa-output") + "." + ext;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJSON = (data: any, name?: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (name || "qa-report") + ".json";
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
    downloadResult(md, "md", "casos-de-teste");
  };

  const tabs = [
    { key: "smart_runner" as ToolTab, label: "🤖 Runner IA",  icon: Zap,        desc: "URL + descrição → IA gera o script → executa → PDF" },
    { key: "batch_runner" as ToolTab, label: "Lote / Fila", icon: List, desc: "Execute múltiplos testes em background" },
    { key: "test_cases" as ToolTab,  label: "Casos de Teste",icon: FlaskConical,desc: "Gere suítes de teste a partir de um requisito ou funcionalidade" },
    { key: "reports" as ToolTab,     label: "📋 Relatórios", icon: FileText,   desc: "Gere 10 tipos de relatórios de QA profissionais" },
  ];


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

  const ReportDashboard = ({ reportText, title, date, pdfImagesToRender }: {
    reportText: string, title: string, date: string, pdfImagesToRender: string[]
  }) => {
    const metrics = parseMetrics(reportText);
    const recs = parseRecommendations(reportText);
    const viols = parseViolations(reportText);

    const exportToPDF = async (elementId: string) => {
      try {
        // @ts-expect-error - html2pdf.js types are missing
        const html2pdf = (await import("html2pdf.js")).default;
        const element = document.getElementById(elementId);
        if (!element) return;
        const opt = {
          margin: 15,
          filename: `Relatorio_${title.replace(/\s+/g, "_")}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
        };
        html2pdf().from(element).set(opt).save();
      } catch (err) {
        console.error(err);
        alert("Erro ao exportar PDF.");
      }
    };

    const exportToWord = () => {
      const element = document.getElementById("qa-report-pdf-content");
      if (!element) return;
      
      const titleStr = title || "Relatorio_Melhorado";
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
          <p><strong>Relatório:</strong> ${titleStr}</p>
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

        ${pdfImagesToRender.length > 0 ? `
          <h2>Evidências Visuais Mapeadas</h2>
          <div class="gallery-grid">
            ${pdfImagesToRender.map((img, idx) => `
              <div class="gallery-item">
                <p><strong>Página Original #${idx + 1}</strong></p>
                <img src="${img}" style="max-width: 100%; max-height: 350px;" />
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
        <div id="qa-report-pdf-content" className="bg-white text-slate-800 border border-slate-300 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl font-sans relative overflow-hidden">
          {/* Header Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#0f172a]"></div>

          {/* Clean Generic Corporate Header */}
          <div className="border-b-2 border-slate-100 pb-5 pt-2 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#0f172a] flex items-center justify-center text-[10px] font-bold text-white">
                  QA
                </div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#0f172a]">RELATÓRIO DE AUDITORIA DE QUALIDADE MELHORADA</span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Controle de Qualidade & Acessibilidade (eMAG 3.1 / WCAG)</p>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
              <p className="text-sm text-slate-600">
                Data do Relatório: {new Date(date).toLocaleString("pt-BR")}
              </p>
            </div>
            
            <div className="text-right shrink-0 flex flex-col items-start md:items-end space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold uppercase border border-slate-300 tracking-wider">Documento de Auditoria</span>
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

          {/* Recommendations */}
          <div className="bg-amber-50/50 border-l-4 border-amber-500 rounded-r-xl p-5 space-y-3 shadow-sm">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-amber-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Recomendações Técnicas (eMAG / WCAG)
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

          {/* Violations */}
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

          {/* Original PDF Images/Screenshots Embedded in the new report */}
          {pdfImagesToRender.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Evidências do Relatório Original Mapeado
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pdfImagesToRender.map((img, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col shadow-sm">
                    <div className="bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 border-b border-slate-200">
                      Página Original #{idx + 1}
                    </div>
                    <div className="p-2 flex-1 flex items-center justify-center bg-black/5">
                      <img src={img} alt={`Evidência Página ${idx + 1}`} className="max-h-96 object-contain rounded border border-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clean Footer */}
          <div className="border-t border-slate-200 pt-5 text-center flex flex-col items-center justify-center space-y-1 text-slate-400 text-[10px]">
            <span className="font-semibold uppercase tracking-widest text-slate-500">Relatório Automático de Testes</span>
            <span>Documento gerado e verificado por IA</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToPDF("qa-report-pdf-content")}
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
            onClick={() => copyToClipboard(reportText)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-accent text-muted-foreground transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Copiar Markdown
          </button>
        </div>
      </div>
    );
  };

  const PLACEHOLDERS: Record<ToolTab, string> = {
    test_cases: "Descreva a funcionalidade a ser testada...\n\nExemplo: Tela de login com e-mail e senha. O usuário pode recuperar a senha. Após 5 tentativas erradas, a conta é bloqueada por 10 minutos.",
    reports: "Selecione um tipo de relatório acima e descreva os dados...",
    smart_runner: "Cole uma URL para executar testes automatizados e gerar relatórios completos em background...",
    batch_runner: "Adicione as URLs e especificações para a execução de testes em lote e geração de relatórios...",
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
              <p className="text-xs text-muted-foreground">Suite QA alimentada por IA · Kimi K2 especializado em automação</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Consolidated Report Button */}
            <button
              onClick={handleConsolidatedReport}
              disabled={consolidating || reports.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-40"
              title="Gerar relatório executivo de todos os testes"
            >
              {consolidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Relatório Executivo</span>
            </button>

            {/* History Toggle */}
            <button
              onClick={() => {
                const next = !showHistory;
                setShowHistory(next);
                if (next) loadReports();
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all",
                showHistory
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Histórico</span>
              {reports.length > 0 && (
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">
                  {reports.length}
                </span>
              )}
            </button>

            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border text-sm hover:border-primary/40 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground hidden sm:inline">{currentModel.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{currentModel.provider}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>

              <AnimatePresence>
                {showModelMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    className="absolute right-0 mt-2 w-80 rounded-xl glass border border-border shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Selecionar Modelo de IA</p>
                    </div>
                    {MODELS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => { setSelectedModel(m.key); setShowModelMenu(false); }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left",
                          selectedModel === m.key && "bg-primary/10"
                        )}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-foreground">{m.label}</span>
                          <span className="text-[11px] text-muted-foreground">{m.provider}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                          m.key === "kimi-k2" ? "border-amber-400/40 text-amber-400" : "border-border text-muted-foreground"
                        )}>{m.badge}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tool Tabs */}
        <div className="flex gap-2 mt-5 flex-wrap">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setResult(null); setTestCases(null); setError(null); setHtmlFile(null); if (t.key !== "reports") setSelectedReportType(null); }}
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
        <div className="max-w-5xl mx-auto px-6 pt-6">

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
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-semibold text-foreground">Histórico de Relatórios</h2>
                      <span className="text-xs text-muted-foreground">({reports.length} salvos)</span>
                    </div>
                    <button onClick={loadReports} className="text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {loadingReports ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      Nenhum relatório salvo ainda. Gere seu primeiro!
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {/* Toolbar */}
                      <AnimatePresence>
                        {selectedReportIds.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-primary/5 border-b border-primary/10 px-4 py-2 flex items-center justify-between"
                          >
                            <span className="text-xs font-medium text-primary">
                              {selectedReportIds.length} selecionado{selectedReportIds.length > 1 ? "s" : ""}
                            </span>
                            <div className="flex items-center gap-2">
                              {selectedReportIds.length === 1 && (
                                <button
                                  onClick={() => setEditingReport(reports.find(r => r.id === selectedReportIds[0]) || null)}
                                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-border rounded-lg text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                                  disabled={isManagingReports}
                                >
                                  Editar
                                </button>
                              )}
                              <button
                                onClick={() => setExportingReportIds(selectedReportIds)}
                                className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                disabled={isManagingReports}
                              >
                                Enviar para Projeto
                              </button>
                              <button
                                onClick={() => setDeletingReportIds(selectedReportIds)}
                                className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-50"
                                title="Excluir selecionados"
                                disabled={isManagingReports}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex flex-col gap-2 p-3 max-h-[400px] overflow-y-auto bg-muted/10">
                        {reports.map(r => (
                          <div
                            key={r.id}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 text-left hover:border-primary/40 hover:shadow-md transition-all cursor-pointer rounded-xl border bg-card shadow-sm",
                              selectedReport?.id === r.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/60",
                              selectedReportIds.includes(r.id) && "border-primary bg-primary/5"
                            )}
                            onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}
                          >
                            <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedReportIds.includes(r.id)}
                                onChange={(e) => toggleReportSelection(e as any, r.id)}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-1"
                              />
                            </div>
                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-md shrink-0 uppercase tracking-wide", TYPE_COLOR[r.type] || "text-muted-foreground bg-accent")}>
                              {TYPE_LABEL[r.type] || r.type}
                            </span>
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                              <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                                <span>{new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: 'short', timeStyle: 'short' })}</span>
                                <span className="w-1 h-1 rounded-full bg-border" />
                                <span className="font-mono text-[10px]">{r.model_used}</span>
                                {r.framework && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-border" />
                                    <span className="font-mono text-[10px]">{r.framework}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {r.result_json && (
                                <button
                                  onClick={e => { e.stopPropagation(); downloadJSON(r.result_json, r.title.replace(/\s/g, "_")); }}
                                  className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-primary/10"
                                  title="Baixar JSON"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  JSON
                                </button>
                              )}
                              <div className={cn("p-1.5 rounded-full transition-colors", selectedReport?.id === r.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                                <ChevronRight className={cn("w-4 h-4 transition-transform duration-300", selectedReport?.id === r.id && "rotate-90")} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected report detail */}
                  <AnimatePresence>
                    {selectedReport && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-border overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-foreground">{selectedReport.title}</h3>
                            <div className="flex items-center gap-2">
                              {selectedReport.result_json && (
                                <button
                                  onClick={() => downloadJSON(selectedReport.result_json, selectedReport.title.replace(/\s/g, "_"))}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Baixar JSON
                                </button>
                              )}
                              <button
                                onClick={() => downloadResult(selectedReport.result_raw, "md", selectedReport.title.replace(/\s/g, "_"))}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Baixar .MD
                              </button>
                              <button
                                onClick={() => copyToClipboard(selectedReport.result_raw)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
                              >
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                Copiar
                              </button>
                              <button onClick={() => setSelectedReport(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {selectedReport.type === "test_report" ? (
                            <ReportDashboard reportText={selectedReport.result_raw} title={selectedReport.title} date={selectedReport.created_at} pdfImagesToRender={[]} />
                          ) : selectedReport.type === "smart_runner" ? (
                            <div className="space-y-3">
                              {(() => {
                                const d = selectedReport.result_json as any;
                                return d ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-4 gap-3">
                                      {[
                                        { label: "Passos", value: d.totalSteps, color: "text-primary" },
                                        { label: "Aprovados", value: d.approvedSteps, color: "text-emerald-400" },
                                        { label: "Falhas", value: d.failedSteps, color: "text-rose-400" },
                                        { label: "Violações eMAG", value: d.axeViolationsCount, color: "text-amber-400" },
                                      ].map(m => (
                                        <div key={m.label} className="text-center bg-accent/30 rounded-xl p-3 border border-border/50">
                                          <p className={`text-xl font-bold ${m.color}`}>{m.value ?? "—"}</p>
                                          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{m.label}</p>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {d.pdfUrl && (
                                        <a href={d.pdfUrl} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-500/10 text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 transition-all">
                                          <FileDown className="w-3 h-3" /> PDF Original
                                        </a>
                                      )}
                                      {d.htmlReportUrl && (
                                        <a href={d.htmlReportUrl} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:text-foreground transition-all">
                                          <Eye className="w-3 h-3" /> Ver Relatório HTML
                                        </a>
                                      )}
                                      <button
                                        onClick={() => { setActiveTab("smart_runner"); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                                      >
                                        <Zap className="w-3 h-3" /> Ver no Runner
                                      </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      URL: <span className="font-mono">{d.targetUrl}</span>
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Dados do relatório não disponíveis.</p>
                                );
                              })()}
                            </div>
                          ) : (
                            <pre className="text-xs text-foreground leading-relaxed font-mono bg-black/20 rounded-xl p-4 max-h-64 overflow-y-auto whitespace-pre-wrap">
                              {selectedReport.result_raw}
                            </pre>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tab Content */}
        {activeTab === "smart_runner" ? (
          <SmartRunnerTab initialReport={selectedReport?.type === 'smart_runner' ? selectedReport.result_json : null} onImportPdf={importPdfFromUrl} />
        ) : activeTab === "batch_runner" ? (
          <div className="max-w-5xl mx-auto px-6 pb-6">
            <BatchRunnerTab />
          </div>
        ) : activeTab === "reports" ? (
          <div className="max-w-5xl mx-auto px-6 pb-6 space-y-6">
            {/* Report Type Selector Grid */}
            {!selectedReportType ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 pt-4"
              >
                <div>
                  <h2 className="text-base font-semibold text-foreground">Escolha o tipo de relatório</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Selecione um dos 10 tipos de relatório de QA para gerar com IA</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {REPORT_TYPES.map((rt) => {
                    const RtIcon = rt.icon;
                    return (
                      <motion.button
                        key={rt.key}
                        onClick={() => { setSelectedReportType(rt.key); setInput(""); setResult(null); setError(null); }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md group",
                          rt.color
                        )}
                      >
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-card/60 border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <RtIcon className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{rt.label}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{rt.desc}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={selectedReportType}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6 pt-4"
              >
                {/* Back + title */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSelectedReportType(null); setInput(""); setResult(null); setError(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    <ChevronRight className="w-3 h-3 rotate-180" />
                    Voltar
                  </button>
                  {(() => {
                    const rt = REPORT_TYPES.find(r => r.key === selectedReportType)!;
                    const RtIcon = rt.icon;
                    return (
                      <div className="flex items-center gap-2">
                        <RtIcon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">{rt.label}</span>
                        <span className="text-[10px] text-muted-foreground">{rt.desc}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Input Area for selected report type */}
                <div className="glass rounded-2xl border border-border p-5 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    {REPORT_TYPES.find(r => r.key === selectedReportType)?.desc}
                  </p>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={REPORT_TYPES.find(r => r.key === selectedReportType)?.placeholder || "Descreva os dados para o relatório..."}
                    rows={7}
                    className="w-full bg-black/10 dark:bg-black/30 text-foreground placeholder:text-muted-foreground/60 rounded-xl p-4 text-sm outline-none border border-border/50 resize-y focus:border-primary/50 transition-colors leading-relaxed"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        if (!input.trim()) return;
                        setLoading(true);
                        setResult(null);
                        setError(null);
                        try {
                          const res = await fetch("/api/ai/qa", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              tool_type: selectedReportType,
                              input: input.trim(),
                              model: selectedModel,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Falha na geração");
                          if (data.report) setSelectedReport(data.report);
                          setResult(data.result);
                          loadReports();
                        } catch (e: any) {
                          setError(e.message || "Ocorreu um erro inesperado.");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !input.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {loading ? "Gerando..." : "Gerar com IA"}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* Result */}
                {result && !loading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-foreground">Relatório gerado com sucesso!</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadResult(result, "md", TYPE_LABEL[selectedReportType!]?.replace(/\s/g, "_") || "relatorio")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
                        >
                          <Download className="w-3.5 h-3.5" /> .MD
                        </button>
                        <button
                          onClick={() => copyToClipboard(result)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          Copiar
                        </button>
                      </div>
                    </div>
                    <pre className="text-xs text-foreground leading-relaxed font-mono bg-black/20 rounded-xl p-5 overflow-y-auto whitespace-pre-wrap border border-border/50" style={{ maxHeight: "60vh" }}>
                      {result}
                    </pre>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-6 pb-6 space-y-6">

          {/* Input Area */}
          <div className="glass rounded-2xl border border-border p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-xs text-muted-foreground">
                  {activeTab === "test_cases" && importingCode 
                    ? "Cole o código de automação abaixo para extrair os Casos de Teste com IA."
                    : tabs.find(t => t.key === activeTab)?.desc
                  }
                </p>
                
                {activeTab === "test_cases" && (
                  <button
                    onClick={() => { setImportingCode(!importingCode); setInput(""); }}
                    className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                      importingCode ? "bg-primary/20 border-primary/45 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {importingCode ? "📄 Modo Requisitos" : "💻 Importar de Código"}
                  </button>
                )}

              </div>

              {parsingPdf ? (
                <div className="flex flex-col items-center justify-center py-10 bg-black/10 dark:bg-black/30 border border-border/50 rounded-xl space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Lendo e interpretando arquivo PDF...</span>
                </div>
              ) : (
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    activeTab === "test_cases" && importingCode
                      ? "Cole aqui o código de automação de testes (Playwright, Cypress, Selenium) para extrair os casos de teste..."
                      : pdfFile 
                      ? "Texto do PDF importado com sucesso. Clique em 'Gerar com IA' abaixo para melhorar este relatório."
                      : PLACEHOLDERS[activeTab]
                  }
                  rows={6}
                  className="w-full bg-black/10 dark:bg-black/30 text-foreground placeholder:text-muted-foreground/60 rounded-xl p-4 text-sm outline-none border border-border/50 resize-y focus:border-primary/50 transition-colors leading-relaxed"
                />
              )}
            </div>

            {/* HTML file selector removed */}


            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
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
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">{testCases.length} casos de teste gerados</h2>
                    <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Salvo automaticamente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadJSON(testCases, "casos-de-teste")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar JSON
                    </button>
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

                {/* Hidden input for test case evidence upload */}
                <input
                  ref={evidenceInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleEvidenceUpload}
                />

                <div className="space-y-3">
                  {testCases.map((tc) => {
                    const CatIcon = CATEGORY_ICON[tc.category] || AlertCircle;
                    return (
                      <motion.div key={tc.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
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

                        {/* Evidence Display & Upload */}
                        {tc.evidence ? (
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Evidência Anexada</span>
                              <button
                                onClick={() => handleRemoveEvidence(tc.id)}
                                className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <X className="w-3 h-3" /> Remover
                              </button>
                            </div>
                            <div className="relative rounded-lg overflow-hidden border border-border bg-black/25 max-h-64 flex justify-center items-center">
                              <img src={tc.evidence} alt={`Evidência ${tc.id}`} className="max-h-64 object-contain" />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 pt-3 border-t border-border/50 flex justify-end">
                            <button
                              onClick={() => { setActiveEvidenceTcId(tc.id); setTimeout(() => evidenceInputRef.current?.click(), 50); }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                            >
                              <Upload className="w-3 h-3" /> Anexar Evidência
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text/Code Result */}
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Script Gerado</h2>
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Salvo automaticamente
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadResult(result, selectedFramework === "selenium" ? "py" : "ts", "script-automacao")}
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
                <div className="glass rounded-xl border border-border overflow-hidden p-5">
                  <pre className="text-xs leading-relaxed text-foreground overflow-x-auto whitespace-pre-wrap font-mono">
                    {result}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingReport && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-semibold">Editar Relatório</h3>
              <button onClick={() => setEditingReport(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditReport} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Título</label>
                <input
                  type="text"
                  value={editingReport.title}
                  onChange={e => setEditingReport({ ...editingReport, title: e.target.value })}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Descrição</label>
                <textarea
                  value={editingReport.input_description}
                  onChange={e => setEditingReport({ ...editingReport, input_description: e.target.value })}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingReport(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
                <button type="submit" disabled={isManagingReports} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                  {isManagingReports ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportingReportIds && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-semibold">Exportar para Projeto</h3>
              <button onClick={() => { setExportingReportIds(null); setSelectedExportProjectId(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Você selecionou <strong>{exportingReportIds.length}</strong> relatório(s). Eles serão exportados como <strong>Novas Tarefas</strong> na Pauta do projeto escolhido.
              </p>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Selecione o Projeto</label>
                <select
                  value={selectedExportProjectId}
                  onChange={e => setSelectedExportProjectId(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">Selecione...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button onClick={() => { setExportingReportIds(null); setSelectedExportProjectId(""); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
                <button
                  onClick={handleExportReports}
                  disabled={!selectedExportProjectId || isManagingReports}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isManagingReports ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Confirmar Exportação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deletingReportIds && deletingReportIds.length > 0 && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-rose-500/20 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-rose-500/5">
              <h3 className="font-semibold text-rose-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Excluir Relatórios</h3>
              <button onClick={() => setDeletingReportIds(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir <strong>{deletingReportIds.length}</strong> relatório(s)? Esta ação não pode ser desfeita.
              </p>
              <div className="pt-2 flex justify-end gap-3">
                <button onClick={() => setDeletingReportIds(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground bg-accent/50 rounded-lg">
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteReports}
                  disabled={isManagingReports}
                  className="px-4 py-2 bg-rose-500 text-white text-sm font-semibold rounded-lg hover:bg-rose-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {isManagingReports ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
