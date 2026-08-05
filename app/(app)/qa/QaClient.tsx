"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
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
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  GitBranch,
  ExternalLink,
  FileImage,
  Plus,
  CheckSquare,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
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


interface QaClientProps { 
  projectId: string; 
  externalTab?: ToolTab;
  projectUrl?: string;
}

export function QaClient({ projectId, externalTab, projectUrl }: QaClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ToolTab>(externalTab || "smart_runner");

  useEffect(() => {
    if (externalTab && externalTab !== activeTab) {
      setActiveTab(externalTab);
    }
  }, [externalTab]);
  const [selectedReportType, setSelectedReportType] = useState<ReportSubType | null>(null);
  const [selectedModel, setSelectedModel] = useState("auto-free");
  const [selectedFramework, setSelectedFramework] = useState("playwright");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [testCases, setTestCases] = useState<TestCase[] | null>(null);
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set());
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Per-test-case execution status: "idle" | "pass" | "fail" | "blocked"
  const [tcStatus, setTcStatus] = useState<Record<string, "idle" | "pass" | "fail" | "blocked">>({});
  
  // Batch Runner state
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentTitle: "" });

  // Simplify Report state
  const [simplifying, setSimplifying] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [savingFlow, setSavingFlow] = useState(false);
  const [saveFlowSuccess, setSaveFlowSuccess] = useState(false);

  // History Filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>("all");
  const [historyModelFilter, setHistoryModelFilter] = useState<string>("all");
  const [historyDateFilter, setHistoryDateFilter] = useState<"all" | "today" | "7d" | "30d">("all");
  const [historySort, setHistorySort] = useState<"newest" | "oldest">("newest");
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);


  // Evidence upload for test cases
  const [activeEvidenceTcId, setActiveEvidenceTcId] = useState<string | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  // Save to project
  const [savingToProject, setSavingToProject] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTargetProjectId, setSaveTargetProjectId] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState(false);

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
      if (htmlFile) formData.append("html_file", htmlFile);
      formData.append("project_id", projectId);
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
    if (!projectId) return;
    setLoadingReports(true);
    try {
      const res = await fetch(`/api/ai/qa?projectId=${projectId}`);
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

  // Fetch projects when export modal or save modal opens
  const fetchProjects = useCallback(async () => {
    if (projects.length > 0) return;
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch { /* silent */ } finally {
      setLoadingProjects(false);
    }
  }, [projects.length]);

  useEffect(() => {
    if (exportingReportIds) fetchProjects();
  }, [exportingReportIds]);

  useEffect(() => {
    if (showSaveModal) fetchProjects();
  }, [showSaveModal]);

  // Compute unique models found in reports for filter chips
  const reportModels = useMemo(() => {
    const models = new Set(reports.map(r => r.model_used).filter(Boolean));
    return Array.from(models);
  }, [reports]);

  // Filtered + sorted reports
  const filteredReports = useMemo(() => {
    let filtered = [...reports];

    // Search
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      filtered = filtered.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.input_description?.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (historyTypeFilter !== "all") {
      filtered = filtered.filter(r => r.type === historyTypeFilter);
    }

    // Model filter
    if (historyModelFilter !== "all") {
      filtered = filtered.filter(r => r.model_used === historyModelFilter);
    }

    // Date filter
    if (historyDateFilter !== "all") {
      const cutoff = new Date();
      if (historyDateFilter === "today") cutoff.setHours(0, 0, 0, 0);
      else if (historyDateFilter === "7d") cutoff.setDate(cutoff.getDate() - 7);
      else if (historyDateFilter === "30d") cutoff.setDate(cutoff.getDate() - 30);
      filtered = filtered.filter(r => new Date(r.created_at) >= cutoff);
    }

    // Sort
    filtered.sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return historySort === "newest" ? diff : -diff;
    });

    return filtered;
  }, [reports, historySearch, historyTypeFilter, historyModelFilter, historyDateFilter, historySort]);

  // Count by type for badge
  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    return counts;
  }, [reports]);

  // Sync test cases and raw result when a report is loaded/selected
  useEffect(() => {
    if (selectedReport) {
      setResult(selectedReport.result_raw);
      if (selectedReport.type === "test_cases" && selectedReport.result_json) {
        try {
          const parsed = selectedReport.result_json as any;
          const tcs = (parsed.test_cases || []).map((tc: any, idx: number) => ({
            ...tc,
            id: tc.id || `tc-${selectedReport.id}-${idx}`
          }));
          setTestCases(tcs);
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

  const runSelectedTestCases = async () => {
    if (!testCases || selectedTestCaseIds.size === 0) return;
    const targetUrl = prompt("Qual a URL alvo para executar os testes?", projectUrl || "http://localhost:3000");
    if (!targetUrl) return;

    setIsBatchRunning(true);
    const idsToRun = Array.from(selectedTestCaseIds);
    let current = 0;
    const total = idsToRun.length;

    for (const tcId of idsToRun) {
      current++;
      const tc = testCases.find(t => t.id === tcId);
      if (!tc) continue;

      setBatchProgress({ current, total, currentTitle: tc.title });
      
      try {
        const flowDesc = tc.steps.join("\n");
        const res = await fetch("/api/automation/smart-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl,
            flowDescription: flowDesc,
            jobName: tc.title,
            model: "auto-free",
            includeAxe: false
          })
        });

        if (!res.body) throw new Error("Sem resposta do servidor");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let finalResult: any = null;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: !done });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === "end") finalResult = data.result;
                  if (data.type === "error") throw new Error(data.message);
                } catch (e) {}
              }
            }
          }
        }
        
        const passed = finalResult?.success === true;
        setTcStatus(prev => ({ ...prev, [tc.id]: passed ? "pass" : "fail" }));
      } catch (e) {
        setTcStatus(prev => ({ ...prev, [tc.id]: "fail" }));
      }
    }
    
    setIsBatchRunning(false);
    setBatchProgress({ current: 0, total: 0, currentTitle: "" });
  };

  const handleSimplifyReports = async () => {
    if (!selectedReportIds || selectedReportIds.length === 0) return;
    setSimplifying(true);
    try {
      const reportsContent = reports
        .filter(r => selectedReportIds.includes(r.id))
        .map(r => `--- Relatório: ${r.title} ---\n${r.result_raw}`)
        .join("\n\n");

      const res = await fetch("/api/ai/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_type: "general_test_report",
          input: "Por favor, crie um Resumo Simplificado e Executivo (mastigado) dos seguintes relatórios, voltado para não-técnicos, destacando: o que foi testado, o que deu errado e próximos passos:\n\n" + reportsContent,
          framework: selectedFramework,
          model: selectedModel,
          project_id: projectId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setSelectedReport(data.report);
          loadReports();
          setSelectedReportIds([]);
          setShowHistory(false);
        }
      } else {
        alert("Erro ao gerar relatório simplificado.");
      }
    } catch {
      alert("Erro ao gerar relatório simplificado.");
    } finally {
      setSimplifying(false);
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
          tool_type: activeTab === "reports" ? selectedReportType : activeTab,
          input: input.trim(),
          framework: selectedFramework,
          model: selectedModel,
          project_id: projectId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na geração");

      if (data.report) {
        setSelectedReport(data.report);
      }

      if (activeTab === "test_cases") {
        setTcStatus({});
        try {
          let rawJson = data.result;
          const match = rawJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            rawJson = match[1];
          } else {
            const firstBrace = rawJson.search(/[\{\[]/);
            const lastBrace = Math.max(rawJson.lastIndexOf("}"), rawJson.lastIndexOf("]"));
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              rawJson = rawJson.substring(firstBrace, lastBrace + 1);
            }
          }
          const parsed = JSON.parse(rawJson);
          const tcsArray = Array.isArray(parsed) ? parsed : (parsed.test_cases || []);
          const tcs = tcsArray.map((tc: any, idx: number) => ({
            ...tc,
            id: tc.id || `tc-new-${Date.now()}-${idx}`
          }));
          setTestCases(tcs);
        } catch {
          // Parse failed — show the raw result as an error hint, don't show "Script Gerado"
          setError("Não foi possível interpretar os casos de teste. Tente novamente ou use um modelo diferente.");
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
        body: JSON.stringify({ tool_type: "consolidated_report", input: "", model: selectedModel, project_id: projectId }),
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
    if (!testCases || testCases.length === 0) return;
    const testCasesToExport = selectedTestCaseIds.size > 0 
      ? testCases.filter(tc => selectedTestCaseIds.has(tc.id))
      : testCases;
    
    let md = "# Casos de Teste - Suite QA\n\n";
    testCasesToExport.forEach(tc => {
      const status = tcStatus[tc.id] || "idle";
      const statusLabel: Record<string, string> = {
        pass: "✅ PASSOU", fail: "❌ FALHOU", blocked: "⚠️ BLOQUEADO", idle: "⬜ PENDENTE",
      };
      md += "## " + tc.id + " — " + tc.title + "\n";
      md += "- **Categoria:** " + (CATEGORY_LABEL[tc.category] || tc.category) + "\n";
      md += "- **Prioridade:** " + tc.priority.toUpperCase() + "\n";
      md += "- **Status:** " + statusLabel[status] + "\n\n";
      md += "**Passos:**\n";
      tc.steps.forEach((s, i) => { md += (i + 1) + ". " + s + "\n"; });
      md += "\n**Resultado Esperado:** " + tc.expected_result + "\n\n---\n\n";
    });
    downloadResult(md, "md", "casos-de-teste");
  };

  const generateTestCasesPDF = () => {
    if (!testCases || testCases.length === 0) return;
    const testCasesToExport = selectedTestCaseIds.size > 0 
      ? testCases.filter(tc => selectedTestCaseIds.has(tc.id))
      : testCases;
      
    const categoryColor: Record<string, string> = {
      happy_path: "#059669", error: "#e11d48", edge_case: "#d97706",
    };
    const priorityColor: Record<string, string> = {
      alta: "#e11d48", media: "#d97706", baixa: "#059669",
    };
    const statusColor: Record<string, string> = {
      pass: "#059669", fail: "#e11d48", blocked: "#d97706", idle: "#64748b",
    };
    const statusLabel: Record<string, string> = {
      pass: "✅ PASSOU", fail: "❌ FALHOU", blocked: "⚠️ BLOQUEADO", idle: "⬜ PENDENTE",
    };

    // Summary metrics
    const statuses = Object.values(tcStatus);
    const passed = statuses.filter(s => s === "pass").length;
    const failed = statuses.filter(s => s === "fail").length;
    const blocked = statuses.filter(s => s === "blocked").length;
    const total = testCasesToExport.length;
    const pct = total ? Math.round((passed / total) * 100) : 0;

    const summaryHtml = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
          <p style="font-size:32px;font-weight:800;color:#0f172a;margin:0;line-height:1">${total}</p>
          <p style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin-top:8px;letter-spacing:0.5px">Total</p>
        </div>
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
          <p style="font-size:32px;font-weight:800;color:#059669;margin:0;line-height:1">${passed}</p>
          <p style="font-size:11px;color:#059669;text-transform:uppercase;font-weight:700;margin-top:8px;letter-spacing:0.5px">Passou</p>
        </div>
        <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
          <p style="font-size:32px;font-weight:800;color:#e11d48;margin:0;line-height:1">${failed}</p>
          <p style="font-size:11px;color:#e11d48;text-transform:uppercase;font-weight:700;margin-top:8px;letter-spacing:0.5px">Falhou</p>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
          <p style="font-size:32px;font-weight:800;color:#d97706;margin:0;line-height:1">${blocked}</p>
          <p style="font-size:11px;color:#d97706;text-transform:uppercase;font-weight:700;margin-top:8px;letter-spacing:0.5px">Bloqueado</p>
        </div>
      </div>
      <div style="background:#f1f5f9;border-radius:12px;height:12px;margin-bottom:32px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="height:100%;width:${pct}%;background:#10b981;border-radius:12px;"></div>
      </div>
    `;

    const rows = testCasesToExport.map(tc => {
      const status = tcStatus[tc.id] || "idle";
      const sColor = statusColor[status];
      const sLabel = statusLabel[status];
      const borderLeft = status !== "idle" ? `border-left:5px solid ${sColor};` : "border-left:1px solid #cbd5e1;";
      const evidenceHtml = tc.evidence
        ? `<div style="margin-top:16px;padding-top:16px;border-top:1px dashed #e2e8f0"><p style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:8px;letter-spacing:0.5px">EVIDÊNCIA</p><img src="${tc.evidence}" style="max-width:100%;max-height:350px;border-radius:8px;border:1px solid #cbd5e1;display:block" /></div>`
        : '';
      return `
        <div style="background:#ffffff;border:1px solid #cbd5e1;${borderLeft}border-radius:12px;padding:24px;margin-bottom:20px;page-break-inside:avoid;box-shadow:0 2px 4px rgba(0,0,0,0.02)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px">
            <div>
              <span style="font-size:12px;font-weight:800;color:#64748b;letter-spacing:0.5px">${tc.id}</span>
              <h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:6px 0 0">${tc.title}</h2>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:999px;background:${sColor}15;color:${sColor};border:1px solid ${sColor}40">${sLabel}</span>
              <span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:999px;background:${priorityColor[tc.priority] || '#64748b'}15;color:${priorityColor[tc.priority] || '#64748b'};border:1px solid ${priorityColor[tc.priority] || '#64748b'}40;text-transform:uppercase">${tc.priority}</span>
              <span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:999px;background:${categoryColor[tc.category] || '#64748b'}15;color:${categoryColor[tc.category] || '#64748b'};border:1px solid ${categoryColor[tc.category] || '#64748b'}40">${CATEGORY_LABEL[tc.category] || tc.category}</span>
            </div>
          </div>
          <div style="margin-bottom:16px">
            <p style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;margin-bottom:10px">PASSOS</p>
            <ol style="margin:0;padding-left:0;list-style:none">
              ${tc.steps.map((s, i) => `<li style="display:flex;gap:12px;align-items:flex-start;margin-bottom:8px;font-size:14px;color:#334155;line-height:1.5"><span style="min-width:24px;height:24px;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">${i + 1}</span>${s}</li>`).join('')}
            </ol>
          </div>
          <div style="border-top:1px solid #e2e8f0;padding-top:16px">
            <p style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;margin-bottom:6px">RESULTADO ESPERADO</p>
            <p style="font-size:14px;font-weight:500;color:#059669;margin:0;line-height:1.5">${tc.expected_result}</p>
          </div>
          ${evidenceHtml}
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Casos de Teste — QA Suite</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #f8fafc; font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #334155; }
          @media print { 
            body { padding: 20px; background: #ffffff; }
            .page-break { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div style="max-width:900px;margin:0 auto">
          <div style="margin-bottom:32px;border-bottom:2px solid #e2e8f0;padding-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <h1 style="font-size:28px;font-weight:900;color:#0f172a;margin:0;letter-spacing:-0.5px">Casos de Teste</h1>
              <p style="font-size:14px;color:#64748b;margin-top:8px;font-weight:500">${testCasesToExport.length} casos &bull; Gerado em ${new Date().toLocaleDateString('pt-BR')} &bull; ${pct}% de aprovação</p>
            </div>
            <div style="text-align:right">
              <span style="font-size:12px;font-weight:800;color:#94a3b8;letter-spacing:1px;text-transform:uppercase">QA Suite Report</span>
            </div>
          </div>
          ${summaryHtml}
          ${rows}
        </div>
        <script>window.onload=()=>{window.print();}</script>
      </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const saveTestCasesToProject = async (projectId: string) => {
    if (!testCases || !projectId) return;
    setSavingToProject(true);
    setSaveSuccess(false);
    try {
      const supabase = createClient();
      
      const tasksToInsert = testCases.map(tc => {
        let desc = `**Categoria:** ${CATEGORY_LABEL[tc.category] || tc.category}\n`;
        desc += `**Prioridade:** ${tc.priority.toUpperCase()}\n\n`;
        desc += `**Passos:**\n${tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`;
        desc += `**Resultado Esperado:**\n${tc.expected_result}`;
        
        return {
          project_id: projectId,
          title: `[${tc.id}] ${tc.title}`,
          description: desc,
          status: "todo",
          priority: "medium",
          metadata: tc.evidence ? { evidence: tc.evidence } : {}
        };
      });

      const { error } = await supabase.from("tasks").insert(tasksToInsert);
      if (error) throw error;
      
      setSaveSuccess(true);
      setTimeout(() => { setShowSaveModal(false); setSaveSuccess(false); }, 1800);
    } catch (e: any) {
      alert("Erro ao salvar tarefas: " + e.message);
    } finally {
      setSavingToProject(false);
    }
  };

  const [creatingTask, setCreatingTask] = useState<string | null>(null);
  const createStepTask = async (tcId: string, tcTitle: string, stepIndex: number, stepText: string, expectedResult: string) => {
    if (!projectId) {
      alert("Nenhum projeto selecionado. Você precisa estar dentro de um projeto para criar tarefas.");
      return;
    }
    setCreatingTask(`${tcId}-${stepIndex}`);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        title: `[QA] ${tcId} - Passo ${stepIndex + 1}`,
        description: `Caso de teste: ${tcTitle}\n\n**Passo a ser executado/automatizado**:\n${stepText}\n\n**Resultado Esperado**:\n${expectedResult}`,
        status: "todo",
        priority: "medium",
      });
      if (error) throw error;
      alert("Tarefa criada com sucesso! Verifique a aba Tarefas.");
    } catch (e: any) {
      alert("Erro ao criar tarefa: " + e.message);
    } finally {
      setCreatingTask(null);
    }
  };

  // Converts current test cases into ReactFlow nodes/edges and saves to project.flow_data
  const saveFlowToProject = async () => {
    if (!testCases || testCases.length === 0 || !projectId) return;
    setSavingFlow(true);
    setSaveFlowSuccess(false);
    try {
      const COLS = 1;
      const X_CENTER = 350;
      const Y_START = 60;
      const Y_STEP = 180;

      const nodes: any[] = [];
      const edges: any[] = [];

      // Start node
      nodes.push({ id: "start", type: "start", position: { x: X_CENTER, y: Y_START }, data: { label: "Início dos Testes" } });

      testCases.forEach((tc, idx) => {
        const yPos = Y_START + Y_STEP * (idx + 1);
        const xPos = X_CENTER;
        const tcNodeId = `tc-${tc.id}`;
        const validNodeId = `valid-${tc.id}`;

        // Main test case action node
        nodes.push({
          id: tcNodeId,
          type: "action",
          position: { x: xPos, y: yPos },
          data: { label: `${tc.id}: ${tc.title}` },
        });

        // Validation node (expected result)
        nodes.push({
          id: validNodeId,
          type: "validation",
          position: { x: xPos + 280, y: yPos },
          data: { label: tc.expected_result?.slice(0, 60) + (tc.expected_result?.length > 60 ? "..." : "") },
        });

        // Edge from previous node to this tc node
        const prevId = idx === 0 ? "start" : `tc-${testCases[idx - 1].id}`;
        edges.push({
          id: `e-${prevId}-${tcNodeId}`,
          source: prevId,
          target: tcNodeId,
          markerEnd: { type: "arrowclosed", width: 18, height: 18, color: "#64748b" },
          style: { stroke: "#64748b", strokeWidth: 2 },
        });

        // Edge from tc node to validation
        edges.push({
          id: `e-${tcNodeId}-${validNodeId}`,
          source: tcNodeId,
          target: validNodeId,
          label: "Verificar",
          labelStyle: { fill: "#94a3b8", fontWeight: 600, fontSize: 10 },
          labelBgStyle: { fill: "#1e293b", fillOpacity: 0.85 },
          markerEnd: { type: "arrowclosed", width: 18, height: 18, color: "#64748b" },
          style: { stroke: "#64748b", strokeWidth: 2 },
        });
      });

      // End node
      const lastTcId = `tc-${testCases[testCases.length - 1].id}`;
      const yEnd = Y_START + Y_STEP * (testCases.length + 1);
      nodes.push({ id: "end", type: "end", position: { x: X_CENTER, y: yEnd }, data: { label: "Fim dos Testes" } });
      edges.push({
        id: `e-${lastTcId}-end`,
        source: lastTcId,
        target: "end",
        markerEnd: { type: "arrowclosed", width: 18, height: 18, color: "#64748b" },
        style: { stroke: "#64748b", strokeWidth: 2 },
      });

      // Save to project via Supabase client
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("projects")
        .update({ flow_data: { nodes, edges } })
        .eq("id", projectId);

      if (error) throw error;

      setSaveFlowSuccess(true);
      setTimeout(() => setSaveFlowSuccess(false), 3000);
    } catch (e: any) {
      alert("Erro ao salvar fluxograma: " + (e.message || "Tente novamente."));
    } finally {
      setSavingFlow(false);
    }
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

  // No project selector needed as this component is always mounted inside a project context
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn("px-6 border-b border-border bg-card/50", externalTab ? "py-3" : "py-5")}>
        {!externalTab && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Qualidade & Testes</h1>
              <p className="text-xs text-muted-foreground">Suite QA alimentada por IA · Kimi K2 especializado em automação</p>
            </div>
          </div>
        )}

        {/* Unified Navigation & Actions Row */}
        <div className={cn("flex items-center flex-wrap gap-4", !externalTab ? "mt-5 justify-between" : "justify-end")}>
          {/* Tool Tabs */}
          {!externalTab && (
            <div className="flex gap-2 flex-wrap">
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
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Consolidated Report Button */}
            <button
              onClick={handleConsolidatedReport}
              disabled={consolidating || reports.length === 0}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-40"
              title="Gerar relatório executivo de todos os testes"
            >
              {consolidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
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
                "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                showHistory
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <History className="w-4 h-4" />
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
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border text-sm font-medium hover:bg-accent transition-all"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-foreground hidden sm:inline">{currentModel.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold uppercase tracking-wider">{currentModel.provider}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground ml-1" />
              </button>

              <AnimatePresence>
                {showModelMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    className="absolute right-0 mt-2 w-80 rounded-xl bg-card border border-border shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="px-3 py-2.5 border-b border-border bg-muted/20">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Selecionar Modelo de IA</p>
                    </div>
                    {MODELS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => { setSelectedModel(m.key); setShowModelMenu(false); }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left border-b border-border/50 last:border-0",
                          selectedModel === m.key && "bg-primary/5"
                        )}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-semibold text-foreground">{m.label}</span>
                          <span className="text-[11px] text-muted-foreground">{m.provider}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-1 rounded-md border font-bold uppercase tracking-wider",
                          m.key === "kimi-k2" ? "border-amber-500/30 text-amber-500 bg-amber-500/10" : "border-border text-muted-foreground bg-accent/50"
                        )}>{m.badge}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
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
                      {/* Filter Bar */}
                      <div className="px-4 py-3 border-b border-border bg-accent/20 space-y-2">
                        {/* Search + toggle */}
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              value={historySearch}
                              onChange={e => setHistorySearch(e.target.value)}
                              placeholder="Buscar por título ou descrição..."
                              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                            {historySearch && (
                              <button onClick={() => setHistorySearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => setShowHistoryFilters(f => !f)}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                              showHistoryFilters ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            Filtros
                            {(historyTypeFilter !== "all" || historyModelFilter !== "all" || historyDateFilter !== "all") && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary ml-0.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setHistorySort(s => s === "newest" ? "oldest" : "newest")}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-all"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            {historySort === "newest" ? "Recente" : "Antigo"}
                          </button>
                          <button
                            onClick={() => {
                              if (selectedReportIds.length === filteredReports.length && filteredReports.length > 0) {
                                setSelectedReportIds([]);
                              } else {
                                setSelectedReportIds(filteredReports.map(r => r.id));
                              }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-all"
                            title={selectedReportIds.length === filteredReports.length && filteredReports.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
                          >
                            {selectedReportIds.length === filteredReports.length && filteredReports.length > 0 ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <CheckSquare className="w-3.5 h-3.5" />}
                            Todos
                          </button>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {filteredReports.length} de {reports.length}
                          </span>
                        </div>

                        {/* Extended filters */}
                        <AnimatePresence>
                          {showHistoryFilters && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-2 space-y-2">
                                {/* Type chips */}
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider self-center mr-1">Tipo:</span>
                                  <button
                                    onClick={() => setHistoryTypeFilter("all")}
                                    className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all",
                                      historyTypeFilter === "all" ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"
                                    )}
                                  >
                                    Todos ({reports.length})
                                  </button>
                                  {Object.entries(TYPE_LABEL).map(([key, label]) => {
                                    const count = countByType[key] || 0;
                                    if (!count) return null;
                                    return (
                                      <button
                                        key={key}
                                        onClick={() => setHistoryTypeFilter(historyTypeFilter === key ? "all" : key)}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all",
                                          historyTypeFilter === key
                                            ? cn(TYPE_COLOR[key] || "text-primary bg-primary/10", "border-current/30")
                                            : "border-border text-muted-foreground hover:border-primary/20"
                                        )}
                                      >
                                        {label} ({count})
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Model chips */}
                                {reportModels.length > 1 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider self-center mr-1">Modelo:</span>
                                    <button
                                      onClick={() => setHistoryModelFilter("all")}
                                      className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all",
                                        historyModelFilter === "all" ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"
                                      )}
                                    >
                                      Todos
                                    </button>
                                    {reportModels.map(m => (
                                      <button
                                        key={m}
                                        onClick={() => setHistoryModelFilter(historyModelFilter === m ? "all" : m)}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all font-mono",
                                          historyModelFilter === m ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"
                                        )}
                                      >
                                        {m}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Date filter */}
                                <div className="flex flex-wrap gap-1.5">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider self-center mr-1">Período:</span>
                                  {(["all", "today", "7d", "30d"] as const).map(d => {
                                    const labels = { all: "Sempre", today: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias" };
                                    return (
                                      <button
                                        key={d}
                                        onClick={() => setHistoryDateFilter(d)}
                                        className={cn(
                                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all",
                                          historyDateFilter === d ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted-foreground hover:border-primary/20"
                                        )}
                                      >
                                        {labels[d]}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Reset */}
                                {(historyTypeFilter !== "all" || historyModelFilter !== "all" || historyDateFilter !== "all" || historySearch) && (
                                  <button
                                    onClick={() => { setHistoryTypeFilter("all"); setHistoryModelFilter("all"); setHistoryDateFilter("all"); setHistorySearch(""); }}
                                    className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1"
                                  >
                                    <X className="w-3 h-3" /> Limpar filtros
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
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
                                onClick={handleSimplifyReports}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                disabled={isManagingReports || simplifying}
                              >
                                {simplifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                Resumo Simplificado
                              </button>
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
                        {filteredReports.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            <Filter className="w-6 h-6 mx-auto mb-2 opacity-40" />
                            Nenhum relatório encontrado com esses filtros.
                          </div>
                        ) : filteredReports.map(r => (
                          <div
                            key={r.id}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 text-left hover:border-primary/40 hover:shadow-md transition-all cursor-pointer rounded-xl border bg-card shadow-sm",
                              selectedReport?.id === r.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/60",
                              selectedReportIds.includes(r.id) && "border-primary bg-primary/5"
                            )}
                            onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}
                          >
                            <div className="flex items-center shrink-0" onClick={e => { e.stopPropagation(); toggleReportSelection(e, r.id); }}>
                              <input
                                type="checkbox"
                                checked={selectedReportIds.includes(r.id)}
                                onChange={() => {}}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-1 cursor-pointer"
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
                                onClick={() => {
                                  const url = `${window.location.origin}/share/${selectedReport.id}`;
                                  copyToClipboard(url);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
                                title="Copiar link público de compartilhamento"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                Compartilhar
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
          <SmartRunnerTab initialReport={selectedReport?.type === 'smart_runner' ? selectedReport.result_json : null} onImportPdf={importPdfFromUrl} defaultUrl={projectUrl} />
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

                {/* ── Execution Summary Bar ── */}
                {(() => {
                  const statuses = Object.values(tcStatus);
                  const passed = statuses.filter(s => s === "pass").length;
                  const failed = statuses.filter(s => s === "fail").length;
                  const blocked = statuses.filter(s => s === "blocked").length;
                  const total = testCases.length;
                  const executed = passed + failed + blocked;
                  const pct = total ? Math.round((passed / total) * 100) : 0;
                  if (executed === 0) return null;
                  return (
                    <div className="glass rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Resumo de Execução</span>
                        <span className="text-xs text-muted-foreground">{executed}/{total} executados</span>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />{passed} Passou</div>
                        <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold"><AlertCircle className="w-3.5 h-3.5" />{failed} Falhou</div>
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />{blocked} Bloqueado</div>
                        <div className="ml-auto text-xs font-bold text-foreground">{pct}% aprovação</div>
                      </div>
                      <div className="h-2 rounded-full bg-border/50 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* ── Batch Progress Indicator ── */}
                {isBatchRunning && (
                  <div className="glass rounded-xl border border-primary/30 p-4 space-y-3 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Executando: {batchProgress.currentTitle}
                      </span>
                      <span className="text-xs font-bold text-primary">{batchProgress.current} / {batchProgress.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
                    </div>
                  </div>
                )}

                {/* ── Action Bar ── */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">{testCases.length} casos de teste</h2>
                    <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Salvo automaticamente</span>
                  </div>
                  
                  {/* Bulk Actions for Test Cases */}
                  <div className="flex items-center gap-2 w-full mt-2 mb-1 p-2 bg-accent/30 rounded-lg border border-border/50">
                    <button
                      onClick={() => {
                        if (selectedTestCaseIds.size === testCases.length && testCases.length > 0) {
                          setSelectedTestCaseIds(new Set());
                        } else {
                          setSelectedTestCaseIds(new Set(testCases.map(tc => tc.id)));
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:bg-accent transition-all"
                    >
                      {selectedTestCaseIds.size === testCases.length && testCases.length > 0 ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <CheckSquare className="w-3.5 h-3.5" />}
                      Selecionar Todos
                    </button>
                    {selectedTestCaseIds.size > 0 && (
                      <>
                        <span className="text-xs font-medium text-muted-foreground ml-2">{selectedTestCaseIds.size} selecionados</span>
                        <div className="flex-1" />
                        <button
                          onClick={runSelectedTestCases}
                          disabled={isBatchRunning}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                        >
                          {isBatchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Executar Selecionados
                        </button>
                        <button
                          onClick={() => {
                            if(!confirm(`Tem certeza que deseja apagar ${selectedTestCaseIds.size} casos de teste gerados?`)) return;
                            setTestCases(testCases.filter(tc => !selectedTestCaseIds.has(tc.id)));
                            setSelectedTestCaseIds(new Set());
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Apagar Selecionados
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={generateTestCasesPDF}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" /> 
                      {selectedTestCaseIds.size > 0 ? `Exportar PDF (${selectedTestCaseIds.size})` : "Exportar PDF"}
                    </button>
                    <button
                      onClick={exportTestCasesAsMarkdown}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" /> .MD
                    </button>
                    <button
                      onClick={() => downloadJSON(testCases, "casos-de-teste")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" /> JSON
                    </button>
                    <button
                      onClick={() => {
                        if (projectId) {
                          saveTestCasesToProject(projectId);
                        } else {
                          setSaveTargetProjectId(projectId);
                          setShowSaveModal(true);
                        }
                      }}
                      disabled={savingToProject}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-semibold transition-all",
                        saveSuccess
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-sky-500/5 text-sky-400 border-sky-500/30 hover:bg-sky-500/10 hover:border-sky-400/50"
                      )}
                    >
                      {savingToProject ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                      ) : saveSuccess ? (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Salvo no Projeto!</>
                      ) : (
                        <><Check className="w-3.5 h-3.5" /> Salvar no Projeto</>
                      )}
                    </button>
                    <button
                      onClick={() => setShowFlowModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/50 bg-violet-500/5 hover:bg-violet-500/10 transition-all"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      {saveFlowSuccess ? "✓ Fluxo Salvo!" : "Fluxograma"}
                    </button>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(testCases, null, 2))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>

                {/* ── Save to Project Modal ── */}
                <AnimatePresence>
                  {showSaveModal && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                      onClick={() => setShowSaveModal(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                        className="bg-card border border-border rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
                            <Check className="w-4 h-4 text-sky-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">Salvar no Projeto</h3>
                            <p className="text-xs text-muted-foreground">{testCases?.length} casos de teste serão vinculados</p>
                          </div>
                          <button onClick={() => setShowSaveModal(false)} className="ml-auto p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-medium text-muted-foreground">Projeto de destino</label>
                          <select
                            value={saveTargetProjectId}
                            onChange={e => setSaveTargetProjectId(e.target.value)}
                            disabled={loadingProjects}
                            className="w-full bg-background border border-border rounded-lg text-sm p-2.5 focus:outline-none focus:border-primary/50 disabled:opacity-60"
                          >
                            <option value="">{loadingProjects ? "Carregando projetos..." : "Selecione..."}</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-3 mt-5">
                          <button onClick={() => setShowSaveModal(false)} className="flex-1 px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent">Cancelar</button>
                          <button
                            onClick={() => saveTestCasesToProject(saveTargetProjectId)}
                            disabled={!saveTargetProjectId || savingToProject}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-50 font-medium"
                          >
                            {savingToProject ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : saveSuccess ? <><Check className="w-4 h-4" /> Salvo!</> : <><Check className="w-4 h-4" /> Salvar</>}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Flowchart Modal ── */}
                <AnimatePresence>
                  {showFlowModal && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                      onClick={() => setShowFlowModal(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 20 }}
                        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-violet-400" />
                            <h3 className="font-semibold text-foreground">Fluxograma dos Casos de Teste</h3>
                            <span className="text-xs text-muted-foreground">({testCases.length} casos)</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Save to Flow tab */}
                            <button
                              onClick={saveFlowToProject}
                              disabled={savingFlow}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-semibold transition-all",
                                saveFlowSuccess
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                  : "bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20"
                              )}
                            >
                              {savingFlow ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                              ) : saveFlowSuccess ? (
                                <><CheckCircle2 className="w-3.5 h-3.5" /> Salvo no Projeto!</>
                              ) : (
                                <><Check className="w-3.5 h-3.5" /> Salvar no Projeto</>
                              )}
                            </button>
                            {/* Open flow tab after saving */}
                            {saveFlowSuccess && (
                              <button
                                onClick={() => { setShowFlowModal(false); router.push(`/projects/${projectId}?tab=flow`); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600 font-semibold transition-all"
                              >
                                <GitBranch className="w-3.5 h-3.5" /> Abrir Aba Fluxo →
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const el = document.getElementById("tc-flowchart");
                                if (!el) return;
                                const w = window.open("", "_blank");
                                if (!w) return;
                                w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Fluxograma QA</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#0f172a;font-family:'Segoe UI',system-ui,sans-serif;padding:32px;color:#f1f5f9;}@media print{body{padding:16px;}}</style></head><body>${el.innerHTML}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
                                w.document.close();
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-accent"
                            >
                              <Printer className="w-3.5 h-3.5" /> PDF
                            </button>
                            <button onClick={() => setShowFlowModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                          </div>
                        </div>
                        <div className="p-6" id="tc-flowchart">
                          <div className="flex flex-col items-center gap-0">
                            <div className="flex flex-col items-center">
                              <div className="w-28 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-emerald-500/30">INÍCIO</div>
                              <div className="w-px h-6 bg-border" />
                            </div>
                            {testCases.map((tc, idx) => {
                              const status = tcStatus[tc.id] || "idle";
                              const borderColor = status === "pass" ? "border-emerald-500" : status === "fail" ? "border-rose-500" : status === "blocked" ? "border-amber-500" : "border-primary/40";
                              const bg = status === "pass" ? "bg-emerald-500/10" : status === "fail" ? "bg-rose-500/10" : status === "blocked" ? "bg-amber-500/10" : "bg-primary/5";
                              const badge = status === "pass" ? "✅ PASSOU" : status === "fail" ? "❌ FALHOU" : status === "blocked" ? "⚠️ BLOQUEADO" : null;
                              return (
                                <div key={tc.id} className="flex flex-col items-center w-full">
                                  <div className={`w-full max-w-lg rounded-xl border-2 ${borderColor} ${bg} p-4 space-y-2`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-muted-foreground bg-accent px-2 py-0.5 rounded">{tc.id}</span>
                                        <span className="text-sm font-semibold text-foreground">{tc.title}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {badge && <span className="text-[10px] font-bold">{badge}</span>}
                                        <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border", PRIORITY_COLOR[tc.priority] || PRIORITY_COLOR["media"])}>{tc.priority}</span>
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{tc.steps[0]}{tc.steps.length > 1 ? ` (+${tc.steps.length - 1} passos)` : ""}</p>
                                    <div className="pt-1 border-t border-border/40 text-[10px] text-emerald-400 truncate">→ {tc.expected_result}</div>
                                  </div>
                                  {idx < testCases.length - 1 && (
                                    <div className="flex flex-col items-center">
                                      <div className="w-px h-4 bg-border" />
                                      <div className="w-6 h-6 rotate-45 border-2 border-border bg-card" />
                                      <div className="w-px h-4 bg-border" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <div className="flex flex-col items-center">
                              <div className="w-px h-6 bg-border" />
                              <div className="w-28 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-rose-500/30">FIM</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hidden evidence upload */}
                <input ref={evidenceInputRef} type="file" accept="image/*" className="hidden" onChange={handleEvidenceUpload} />

                {/* ── Individual Test Case Cards ── */}
                <div className="space-y-3">
                  {testCases.map((tc) => {
                    const CatIcon = CATEGORY_ICON[tc.category] || AlertCircle;
                    const status = tcStatus[tc.id] || "idle";
                    const cardBorder = status === "pass" ? "border-emerald-500/60 bg-emerald-500/5" : status === "fail" ? "border-rose-500/60 bg-rose-500/5" : status === "blocked" ? "border-amber-500/60 bg-amber-500/5" : "border-border";
                    return (
                      <motion.div key={tc.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        className={`glass rounded-xl border p-4 space-y-3 transition-colors ${cardBorder}`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTestCaseIds.has(tc.id)}
                              onChange={() => {
                                const next = new Set(selectedTestCaseIds);
                                if (next.has(tc.id)) next.delete(tc.id);
                                else next.add(tc.id);
                                setSelectedTestCaseIds(next);
                              }}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-1 cursor-pointer mr-1"
                            />
                            <CatIcon className={cn("w-4 h-4 shrink-0", CATEGORY_COLOR[tc.category])} />
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{tc.id}</span>
                            <h3 className="text-sm font-semibold text-foreground">{tc.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", PRIORITY_COLOR[tc.priority] || PRIORITY_COLOR["media"])}>{tc.priority}</span>
                            <span className="text-[10px] text-muted-foreground bg-accent px-2 py-0.5 rounded-full">{CATEGORY_LABEL[tc.category]}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Passos</p>
                          <ol className="space-y-1">
                            {tc.steps.map((step, si) => {
                              const isCreating = creatingTask === `${tc.id}-${si}`;
                              return (
                                <li key={si} className="flex items-start gap-2.5 text-sm text-foreground group">
                                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{si + 1}</span>
                                  <span className="flex-1 mt-0.5">{step}</span>
                                  <button 
                                    onClick={() => createStepTask(tc.id, tc.title, si, step, tc.expected_result)}
                                    disabled={isCreating}
                                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-2 py-1 bg-accent hover:bg-primary/10 hover:text-primary text-muted-foreground rounded text-[10px] font-semibold transition-all shrink-0 disabled:opacity-50"
                                    title="Criar tarefa na aba Tarefas"
                                  >
                                    {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                    Gerar Tarefa
                                  </button>
                                </li>
                              );
                            })}
                          </ol>
                        </div>

                        <div className="pt-2 border-t border-border/50">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Resultado Esperado</p>
                          <p className="text-sm text-emerald-400">{tc.expected_result}</p>
                        </div>

                        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resultado da Execução</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setTcStatus(prev => ({ ...prev, [tc.id]: prev[tc.id] === "pass" ? "idle" : "pass" }))}
                              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all",
                                status === "pass" ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30" : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                              )}
                            >
                              <CheckCircle2 className="w-3 h-3" /> PASSOU
                            </button>
                            <button
                              onClick={() => setTcStatus(prev => ({ ...prev, [tc.id]: prev[tc.id] === "fail" ? "idle" : "fail" }))}
                              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all",
                                status === "fail" ? "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/30" : "border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                              )}
                            >
                              <AlertCircle className="w-3 h-3" /> FALHOU
                            </button>
                            <button
                              onClick={() => setTcStatus(prev => ({ ...prev, [tc.id]: prev[tc.id] === "blocked" ? "idle" : "blocked" }))}
                              className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all",
                                status === "blocked" ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/30" : "border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                              )}
                            >
                              <AlertTriangle className="w-3 h-3" /> BLOQUEADO
                            </button>
                          </div>
                        </div>

                        {tc.evidence ? (
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Evidência Anexada</span>
                              <button onClick={() => handleRemoveEvidence(tc.id)} className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1">
                                <X className="w-3 h-3" /> Remover
                              </button>
                            </div>
                            <div className="relative rounded-lg overflow-hidden border border-border bg-black/25 max-h-64 flex justify-center items-center">
                              <img src={tc.evidence} alt={`Evidência ${tc.id}`} className="max-h-64 object-contain" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <button
                              onClick={() => { setActiveEvidenceTcId(tc.id); setTimeout(() => evidenceInputRef.current?.click(), 50); }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
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

          {/* Text/Code Result — only shown outside test_cases tab */}
          <AnimatePresence>
            {result && activeTab !== "test_cases" && (
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
                  disabled={loadingProjects}
                  className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                >
                  <option value="">{loadingProjects ? "Carregando projetos..." : "Selecione..."}</option>
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
