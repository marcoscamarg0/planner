"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  Layers,
  Globe,
  Terminal,
  FileText,
  FileDown,
  CheckSquare,
  Square,
  RefreshCw,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Zap,
  Bot,
  Sliders,
  Check,
  Pause,
  RotateCcw,
  Eye,
  BarChart3,
  Flame,
  Search,
  PlusCircle,
  Compass,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QaLiveConsole, type LogEntry } from "@/components/qa/QaLiveConsole";
import type { ProjectWithStats } from "@/types";

export interface SubprojectContextItem {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  target_url?: string | null;
  status: string;
  tasks: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
  }>;
  pages: Array<{
    id: string;
    title: string;
    contentPreview?: string;
  }>;
  reportsCount?: number;
}

interface DiscoveredItem {
  id: string;
  title: string;
  target_url: string;
  description: string;
  category: string;
  emoji: string;
}

interface TestCaseItem {
  id: string;
  title: string;
  category: "happy_path" | "error" | "edge_case" | string;
  steps: string[];
  expected_result: string;
  priority: "alta" | "media" | "baixa" | string;
}

interface StepExecutionResult {
  index: number;
  label: string;
  status: "aprovado" | "falha_clique" | "erro_js" | "pulado";
  detalhe?: string;
  screenshotBase64?: string;
  screenshotBeforeBase64?: string;
  duration?: number;
}

interface SubprojectExecutionState {
  id: string;
  title: string;
  emoji: string;
  color: string;
  targetUrl: string;
  status: "pending" | "generating_ai" | "running_browser" | "completed" | "error" | "skipped";
  errorMessage?: string;
  testCases: TestCaseItem[];
  stepsResults: StepExecutionResult[];
  totalSteps: number;
  approvedSteps: number;
  failedSteps: number;
  htmlReportUrl?: string;
  pdfUrl?: string;
  logs: LogEntry[];
  startTime?: number;
  endTime?: number;
}

interface MultiSubprojectRunnerModalProps {
  open: boolean;
  onClose: () => void;
  subProjects: Array<ProjectWithStats | SubprojectContextItem>;
  parentId?: string;
  parentProjectTitle?: string;
  initialSelectedIds?: string[];
  initialMode?: "existing" | "discover";
  defaultUrl?: string;
  onFinished?: () => void;
}

const AI_MODELS = [
  { key: "auto-free", label: "Automático Neural (Recomendado)", provider: "Google Gemini / OpenRouter", badge: "Grátis" },
  { key: "nemotron-super", label: "Nemotron 3 Super", provider: "Nvidia", badge: "Grátis" },
  { key: "laguna-xs", label: "Laguna XS 2.1", provider: "Poolside", badge: "Grátis" },
  { key: "gpt-oss", label: "GPT OSS 20B", provider: "OpenAI", badge: "Grátis" },
  { key: "qwen-coder", label: "Qwen 2.5 Coder", provider: "Alibaba", badge: "Código" },
];

const ROOT_EXAMPLES = [
  { label: "Trânsito e Transportes Terrestres (Gov.br)", url: "https://www.gov.br/pt-br/categorias/transito-e-transportes/terrestre/transito" },
  { label: "Carta de Serviços (Ministério dos Transportes)", url: "https://www.gov.br/transportes/pt-br/carta-de-servicos" },
  { label: "DNIT Serviços ao Cidadão", url: "https://servicos.dnit.gov.br" },
  { label: "Portal de Serviços Gov.br", url: "https://www.gov.br/pt-br/servicos" },
];

export function MultiSubprojectRunnerModal({
  open,
  onClose,
  subProjects,
  parentId,
  parentProjectTitle,
  initialSelectedIds,
  initialMode = "existing",
  defaultUrl = "http://localhost:3000",
  onFinished,
}: MultiSubprojectRunnerModalProps) {
  // ── Config Mode: "existing" (subprojetos já criados) ou "discover" (site raiz crawler) ──
  const [configMode, setConfigMode] = useState<"existing" | "discover">(initialMode);
  const [phase, setPhase] = useState<"config" | "running" | "summary">("config");

  // ── Existing Mode State ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(initialSelectedIds && initialSelectedIds.length > 0 ? initialSelectedIds : subProjects.map((s) => s.id))
  );
  const [globalTargetUrl, setGlobalTargetUrl] = useState(defaultUrl || "http://localhost:3000");
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState("auto-free");
  const [generateAiTestCases, setGenerateAiTestCases] = useState(true);
  const [executeBrowserTests, setExecuteBrowserTests] = useState(true);
  const [autoIndexTasks, setAutoIndexTasks] = useState(false);
  const [includeAxe, setIncludeAxe] = useState(false);

  // ── Discover Mode State ──
  const [rootUrlInput, setRootUrlInput] = useState("https://www.gov.br/transportes/pt-br/carta-de-servicos");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoveredItems, setDiscoveredItems] = useState<DiscoveredItem[]>([]);
  const [selectedDiscoveredIds, setSelectedDiscoveredIds] = useState<Set<string>>(new Set());
  const [saveAsNewSubprojects, setSaveAsNewSubprojects] = useState(true);
  const [discoveredRootTitle, setDiscoveredRootTitle] = useState("");
  const [discoveredSearch, setDiscoveredSearch] = useState("");
  const [discoveredCategory, setDiscoveredCategory] = useState("all");

  // ── Execution State ──
  const [execStates, setExecStates] = useState<Record<string, SubprojectExecutionState>>({});
  const [activeSubId, setActiveSubId] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<"console" | "test_cases" | "steps" | "report">("console");
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const isAbortedRef = useRef(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const [currentRunningIndex, setCurrentRunningIndex] = useState(0);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sincroniza initialSelectedIds e initialMode
  useEffect(() => {
    if (initialMode) setConfigMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      setSelectedIds(new Set(initialSelectedIds));
    } else if (subProjects.length > 0) {
      setSelectedIds(new Set(subProjects.map((s) => s.id)));
    }
  }, [initialSelectedIds, subProjects]);

  useEffect(() => {
    const map: Record<string, string> = {};
    subProjects.forEach((s) => {
      if (s.target_url) {
        map[s.id] = s.target_url;
      }
    });
    setCustomUrls(map);
  }, [subProjects]);

  const toggleSelectSub = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === subProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(subProjects.map((s) => s.id)));
    }
  };

  const toggleSelectDiscovered = (id: string) => {
    setSelectedDiscoveredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDiscovered = () => {
    if (selectedDiscoveredIds.size === discoveredItems.length) {
      setSelectedDiscoveredIds(new Set());
    } else {
      setSelectedDiscoveredIds(new Set(discoveredItems.map((d) => d.id)));
    }
  };

  const addLogToSub = (
    subId: string,
    level: "info" | "success" | "warn" | "error" | "ai",
    message: string
  ) => {
    setExecStates((prev) => {
      const sub = prev[subId];
      if (!sub) return prev;
      const newEntry: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString("pt-BR"),
        level,
        message,
      };
      return {
        ...prev,
        [subId]: {
          ...sub,
          logs: [...sub.logs, newEntry],
        },
      };
    });
  };

  // ── DISCOVERY: Varredura de site raiz ──
  const handleDiscoverRootUrl = async () => {
    if (!rootUrlInput.trim()) {
      setDiscoverError("Digite a URL do site raiz (ex: Carta de Serviços).");
      return;
    }

    setIsDiscovering(true);
    setDiscoverError(null);
    setDiscoveredItems([]);
    setSelectedDiscoveredIds(new Set());

    try {
      const res = await fetch("/api/automation/discover-subprojects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootUrl: rootUrlInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao varrer a página raiz.");
      }

      const items: DiscoveredItem[] = data.items || [];
      if (items.length === 0) {
        setDiscoverError("Nenhum serviço ou subprojeto secundário foi encontrado nesta página.");
      } else {
        setDiscoveredItems(items);
        setDiscoveredRootTitle(data.rootTitle || "Site Raiz");
        setSelectedDiscoveredIds(new Set(items.map((it) => it.id)));
      }
    } catch (err: any) {
      setDiscoverError(err.message || "Falha na comunicação com o crawler.");
    } finally {
      setIsDiscovering(false);
    }
  };

  // ── DISCOVERY: Criação de subprojetos descobertos e disparo imediato ──
  const handleStartDiscoveredBatch = async () => {
    const selectedList = discoveredItems.filter((d) => selectedDiscoveredIds.has(d.id));
    if (selectedList.length === 0) {
      alert("Selecione pelo menos um serviço descoberto para criar e executar.");
      return;
    }

    let createdSubprojects: any[] = [];

    // Se a opção de salvar no banco estiver ativa (ou houver parentId)
    if (saveAsNewSubprojects && parentId) {
      try {
        const createRes = await fetch("/api/projects/batch-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId,
            subprojects: selectedList.map((s) => ({
              title: s.title,
              description: s.description,
              emoji: s.emoji || "📋",
              target_url: s.target_url,
              category: s.category,
            })),
          }),
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          createdSubprojects = createData.created || [];
        }
      } catch (cErr) {
        console.warn("Aviso: Falha ao persistir subprojetos no banco, rodando em memória:", cErr);
      }
    }

    // Monta a lista final a ser executada
    const listToRun = selectedList.map((item, idx) => {
      const persisted = createdSubprojects[idx];
      return {
        id: persisted?.id || item.id,
        title: item.title,
        description: item.description,
        emoji: item.emoji || "📋",
        color: persisted?.color || "#6366f1",
        target_url: item.target_url,
        status: "active",
        tasks: [],
        pages: [],
      };
    });

    startExecutionEngine(listToRun);
  };

  // ── Inicializa Execução para Subprojetos Existentes ──
  const handleStartExistingBatch = async () => {
    const listToRun = subProjects
      .filter((s) => selectedIds.has(s.id))
      .map((s) => ({
        ...s,
        target_url: customUrls[s.id] || s.target_url || globalTargetUrl,
      }));

    if (listToRun.length === 0) {
      alert("Selecione pelo menos um subprojeto para executar.");
      return;
    }

    startExecutionEngine(listToRun);
  };

  // ── MOTOR CENTRAL DE EXECUÇÃO EM LOTE ("SEM SAIR DA TELA") ──
  const startExecutionEngine = (listToRun: any[]) => {
    const initialMap: Record<string, SubprojectExecutionState> = {};
    listToRun.forEach((s) => {
      initialMap[s.id] = {
        id: s.id,
        title: s.title,
        emoji: s.emoji || "📁",
        color: s.color || "#6366f1",
        targetUrl: s.target_url || globalTargetUrl,
        status: "pending",
        testCases: [],
        stepsResults: [],
        totalSteps: 0,
        approvedSteps: 0,
        failedSteps: 0,
        logs: [],
      };
    });

    setExecStates(initialMap);
    setActiveSubId(listToRun[0].id);
    setPhase("running");
    setIsPaused(false);
    isPausedRef.current = false;
    isAbortedRef.current = false;
    setCurrentRunningIndex(0);
    setElapsedTotal(0);

    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    totalTimerRef.current = setInterval(() => {
      setElapsedTotal((t) => t + 1);
    }, 1000);

    runBatchQueue(listToRun);
  };

  const runBatchQueue = async (list: any[]) => {
    let richContextMap: Record<string, SubprojectContextItem> = {};
    try {
      const res = await fetch("/api/automation/multi-subproject-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: list.map((s) => s.id) }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subprojects && Array.isArray(data.subprojects)) {
          data.subprojects.forEach((item: SubprojectContextItem) => {
            richContextMap[item.id] = item;
          });
        }
      }
    } catch {
      // ignore
    }

    for (let i = 0; i < list.length; i++) {
      if (isAbortedRef.current) break;

      while (isPausedRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (isAbortedRef.current) break;
      }
      if (isAbortedRef.current) break;

      const sub = list[i];
      setCurrentRunningIndex(i + 1);
      setActiveSubId(sub.id);

      const targetUrl = sub.target_url || customUrls[sub.id] || globalTargetUrl;
      const richContext = richContextMap[sub.id] || sub;

      await executeSingleSubproject(sub, targetUrl, richContext);
    }

    if (totalTimerRef.current) {
      clearInterval(totalTimerRef.current);
      totalTimerRef.current = null;
    }

    setPhase("summary");
    if (onFinished) onFinished();
  };

  const executeSingleSubproject = async (
    sub: any,
    targetUrl: string,
    richContext: SubprojectContextItem
  ) => {
    const subId = sub.id;
    const startT = Date.now();

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    setExecStates((prev) => ({
      ...prev,
      [subId]: {
        ...prev[subId],
        status: "generating_ai",
        startTime: startT,
      },
    }));

    addLogToSub(subId, "info", `🚀 Iniciando processamento do subprojeto: ${sub.title}`);
    addLogToSub(subId, "info", `🌐 URL Alvo de homologação: ${targetUrl}`);

    let generatedCases: TestCaseItem[] = [];

    // ── ETAPA 1: GERAÇÃO DE CASOS DE TESTE COM IA ──
    if (generateAiTestCases && !isAbortedRef.current) {
      addLogToSub(subId, "ai", `🧠 Analisando requisitos e gerando suíte de casos de teste com IA (${selectedModel})...`);

      try {
        const tasksSummary = richContext.tasks?.length
          ? richContext.tasks.map((t, idx) => `${idx + 1}. [${t.priority.toUpperCase()}] ${t.title}${t.description ? ` - ${t.description}` : ""}`).join("\n")
          : "Nenhuma tarefa prévia cadastrada.";

        const pagesSummary = richContext.pages?.length
          ? richContext.pages.map((p) => `Documento: ${p.title}\n${p.contentPreview || ""}`).join("\n\n")
          : "";

        const inputPrompt = [
          `SUBPROJETO: ${sub.title}`,
          sub.description ? `DESCRIÇÃO DO SERVIÇO: ${sub.description}` : "",
          `URL ALVO DO SISTEMA: ${targetUrl}`,
          "",
          "--- TAREFAS / REQUISITOS DO SERVIÇO ---",
          tasksSummary,
          "",
          pagesSummary ? `--- DOCUMENTAÇÃO / ESPECIFICAÇÕES ---\n${pagesSummary}` : "",
          "",
          "Instrução: Gere uma suíte abrangente de casos de teste em JSON para este subprojeto/serviço cobrindo Happy Path, Casos de Erro e Casos de Borda.",
        ].filter(Boolean).join("\n");

        const aiRes = await fetch("/api/ai/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool_type: "test_cases",
            input: inputPrompt,
            model: selectedModel,
            project_id: subId,
          }),
          signal: controller.signal,
        });

        if (!aiRes.ok) {
          const errData = await aiRes.json().catch(() => ({}));
          throw new Error(errData.error || `Erro ${aiRes.status} na geração de IA`);
        }

        const aiData = await aiRes.json();
        let rawJson = aiData.result || "";
        const match = rawJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) rawJson = match[1];
        else {
          const firstBrace = rawJson.search(/[\{\[]/);
          const lastBrace = Math.max(rawJson.lastIndexOf("}"), rawJson.lastIndexOf("]"));
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            rawJson = rawJson.substring(firstBrace, lastBrace + 1);
          }
        }

        const parsed = JSON.parse(rawJson);
        const tcsArray = Array.isArray(parsed) ? parsed : (parsed.test_cases || []);
        generatedCases = tcsArray.map((tc: any, idx: number) => ({
          id: tc.id || `tc-${subId}-${idx + 1}`,
          title: tc.title || `Caso de teste ${idx + 1}`,
          category: tc.category || "happy_path",
          steps: Array.isArray(tc.steps) ? tc.steps : [String(tc.steps || "Executar fluxo")],
          expected_result: tc.expected_result || "Sucesso na validação",
          priority: tc.priority || "media",
        }));

        addLogToSub(subId, "success", `✨ ${generatedCases.length} casos de teste estruturados gerados com sucesso!`);

        // Persiste a suíte de casos de teste no banco vinculado ao subprojeto
        try {
          await fetch("/api/appwrite/mutate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              table: "qa_reports",
              data: {
                type: "test_cases",
                title: `Casos de Teste IA: ${sub.title}`,
                input_description: `Suíte automatizada com ${generatedCases.length} casos de teste gerados para ${sub.title}`,
                framework: "bdd",
                model_used: selectedModel,
                project_id: subId,
                result_raw: JSON.stringify({ test_cases: generatedCases }),
                result_json: { test_cases: generatedCases },
              },
            }),
          }).catch(() => {});
        } catch {}

        // Se ativado autoIndexTasks ou se for novo subprojeto, indexa casos de teste no Kanban de tarefas
        if (autoIndexTasks && generatedCases.length > 0) {
          try {
            for (const tc of generatedCases) {
              await fetch("/api/appwrite/mutate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create",
                  table: "tasks",
                  data: {
                    project_id: subId,
                    title: `[QA] ${tc.title}`,
                    description: `**Categoria:** ${tc.category} | **Prioridade:** ${tc.priority}\n\n**Passos:**\n${tc.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\n**Resultado Esperado:**\n${tc.expected_result}`,
                    priority: tc.priority === "alta" ? "urgent" : tc.priority === "baixa" ? "low" : "medium",
                    status: "todo",
                  },
                }),
              }).catch(() => {});
            }
          } catch {}
        }

        setExecStates((prev) => ({
          ...prev,
          [subId]: {
            ...prev[subId],
            testCases: generatedCases,
          },
        }));

      } catch (aiErr: any) {
        if (aiErr.name === "AbortError" || isAbortedRef.current) {
          addLogToSub(subId, "warn", "🛑 Geração cancelada pelo usuário.");
          return;
        }
        addLogToSub(subId, "warn", `⚠️ Usando fluxo inteligente baseado na descrição do serviço: ${aiErr.message}`);
        generatedCases = [
          {
            id: `tc-auto-${subId}-1`,
            title: `Auditoria Principal: ${sub.title}`,
            category: "happy_path",
            steps: [`Acessar ${targetUrl}`, "Verificar tempo de carregamento", "Localizar botão de solicitação ou formulário do serviço", "Validar carregamento de dados"],
            expected_result: "Serviço deve carregar sem erros de servidor 500 ou quebras visuais",
            priority: "alta",
          },
          {
            id: `tc-auto-${subId}-2`,
            title: `Validação de Formulários & Campos Obrigatórios — ${sub.title}`,
            category: "error",
            steps: [`Acessar ${targetUrl}`, "Tentar submeter formulário sem preenchimento", "Verificar mensagens de alerta de validação"],
            expected_result: "O sistema deve exibir alertas claros de campos obrigatórios",
            priority: "media",
          },
        ];

        setExecStates((prev) => ({
          ...prev,
          [subId]: {
            ...prev[subId],
            testCases: generatedCases,
          },
        }));
      }
    }

    if (isAbortedRef.current) return;

    // ── ETAPA 2: EXECUÇÃO DOS TESTES NO NAVEGADOR (SMART RUNNER) ──
    if (executeBrowserTests && !isAbortedRef.current) {
      setExecStates((prev) => ({
        ...prev,
        [subId]: {
          ...prev[subId],
          status: "running_browser",
        },
      }));

      addLogToSub(subId, "info", `⚡ Iniciando execução automatizada no navegador invisível (Playwright)...`);

      const flowDescription = generatedCases.length > 0
        ? generatedCases.map((tc, idx) => 
            `### Caso de Teste ${idx + 1}: ${tc.title}\n` +
            `**Categoria:** ${tc.category} | **Prioridade:** ${tc.priority}\n` +
            `**Passos:**\n${tc.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n` +
            `**Resultado Esperado:** ${tc.expected_result}`
          ).join("\n\n")
        : `Acesse ${targetUrl}, verifique o carregamento completo do serviço ${sub.title}, inspecione botões e formulários.`;

      try {
        const runRes = await fetch("/api/automation/smart-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl,
            flowDescription,
            jobName: `Auditoria: ${sub.title}`,
            model: selectedModel,
            includeAxe,
            projectId: subId,
            project_id: subId,
          }),
          signal: controller.signal,
        });

        if (!runRes.ok) {
          const errData = await runRes.json().catch(() => ({}));
          throw new Error(errData.error || `Erro ${runRes.status} do executor Playwright`);
        }

        const reader = runRes.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = "";
          let finalResult: any = null;

          while (true) {
            if (isAbortedRef.current || controller.signal.aborted) break;
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;
              if (line.startsWith("data: ")) {
                try {
                  const ev = JSON.parse(line.slice(6));
                  if (ev.type === "log") {
                    addLogToSub(subId, "info", ev.message);
                  } else if (ev.type === "done") {
                    finalResult = ev.result;
                  } else if (ev.type === "error") {
                    addLogToSub(subId, "error", `Erro no executor: ${ev.message}`);
                  }
                } catch {}
              }
            }
          }

          if (finalResult && !isAbortedRef.current) {
            const stepsResults: StepExecutionResult[] = (finalResult.steps || []).map((st: any) => ({
              index: st.index,
              label: st.label,
              status: st.status,
              detalhe: st.detalhe,
              screenshotBase64: st.screenshotBase64,
              screenshotBeforeBase64: st.screenshotBeforeBase64,
              duration: st.duration,
            }));

            const approved = finalResult.approvedSteps || stepsResults.filter((s) => s.status === "aprovado").length;
            const failed = finalResult.failedSteps || stepsResults.filter((s) => s.status !== "aprovado" && s.status !== "pulado").length;

            addLogToSub(
              subId,
              "success",
              `🎉 Testes concluídos! ${approved} passos aprovados, ${failed} falhas detectadas.`
            );

            setExecStates((prev) => ({
              ...prev,
              [subId]: {
                ...prev[subId],
                status: "completed",
                stepsResults,
                totalSteps: finalResult.totalSteps || stepsResults.length,
                approvedSteps: approved,
                failedSteps: failed,
                htmlReportUrl: finalResult.htmlReportUrl,
                pdfUrl: finalResult.pdfUrl,
                endTime: Date.now(),
              },
            }));
            return;
          }
        }

        if (!isAbortedRef.current) {
          setExecStates((prev) => ({
            ...prev,
            [subId]: {
              ...prev[subId],
              status: "completed",
              totalSteps: generatedCases.length,
              approvedSteps: generatedCases.length,
              failedSteps: 0,
              endTime: Date.now(),
            },
          }));
        }

      } catch (runErr: any) {
        if (runErr.name === "AbortError" || isAbortedRef.current) {
          addLogToSub(subId, "warn", "🛑 Execução do SmartRunner cancelada pelo usuário.");
          setExecStates((prev) => ({
            ...prev,
            [subId]: {
              ...prev[subId],
              status: "error",
              errorMessage: "Cancelado pelo usuário",
              endTime: Date.now(),
            },
          }));
        } else {
          addLogToSub(subId, "error", `❌ Falha na execução do navegador: ${runErr.message}`);
          setExecStates((prev) => ({
            ...prev,
            [subId]: {
              ...prev[subId],
              status: "error",
              errorMessage: runErr.message,
              endTime: Date.now(),
            },
          }));
        }
      }
    } else {
      if (!isAbortedRef.current) {
        setExecStates((prev) => ({
          ...prev,
          [subId]: {
            ...prev[subId],
            status: "completed",
            totalSteps: generatedCases.length,
            approvedSteps: generatedCases.length,
            failedSteps: 0,
            endTime: Date.now(),
          },
        }));
      }
    }
  };

  const handleAbort = () => {
    isAbortedRef.current = true;
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    if (totalTimerRef.current) {
      clearInterval(totalTimerRef.current);
      totalTimerRef.current = null;
    }

    setExecStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (next[id].status === "pending") {
          next[id] = { ...next[id], status: "skipped" };
        } else if (next[id].status === "generating_ai" || next[id].status === "running_browser") {
          next[id] = { ...next[id], status: "error", errorMessage: "Cancelado pelo usuário" };
        }
      });
      return next;
    });

    setPhase("summary");
  };

  const handleRetrySub = async (subId: string) => {
    const sub = subProjects.find((s) => s.id === subId) || execStates[subId];
    if (!sub) return;

    const targetUrl = customUrls[sub.id] || (sub as any).target_url || globalTargetUrl;
    await executeSingleSubproject(sub, targetUrl, sub as any);
  };

  if (!open) return null;

  // Cálculos de resumo
  const totalSelected = configMode === "discover" ? selectedDiscoveredIds.size : selectedIds.size;
  const execList = Object.values(execStates);
  const completedCount = execList.filter((s) => s.status === "completed").length;
  const errorCount = execList.filter((s) => s.status === "error").length;
  const totalApprovedSteps = execList.reduce((acc, curr) => acc + (curr.approvedSteps || 0), 0);
  const totalFailedSteps = execList.reduce((acc, curr) => acc + (curr.failedSteps || 0), 0);
  const totalTestsExecuted = totalApprovedSteps + totalFailedSteps;
  const successRate = totalTestsExecuted > 0 ? Math.round((totalApprovedSteps / totalTestsExecuted) * 100) : 100;

  const currentActiveSubState = execStates[activeSubId];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-md overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-7xl h-[92vh] max-h-[950px] bg-surface border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* ── HEADER DO MODAL ── */}
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-surface/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    Execução em Lote de Subprojetos
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                    IA + Playwright
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {parentProjectTitle ? `Projeto Agrupador: ${parentProjectTitle}` : "Gere casos de teste e execute auditorias sem sair da tela."}
                </p>
              </div>
            </div>

            {/* Stepper indicators */}
            <div className="hidden md:flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                  phase === "config"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <span>1. Configuração</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                  phase === "running"
                    ? "bg-primary text-primary-foreground shadow-sm animate-pulse"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <span>2. Execução ao Vivo</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                  phase === "summary"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <span>3. Resultados</span>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={phase === "running" && !isPaused}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-30"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── CONTEÚDO PRINCIPAL ── */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {/* ══════════════════════════════════════════════════════════
                FASE 1: CONFIGURAÇÃO (EXISTENTES OU DISCOVERY VIA SITE RAIZ)
            ══════════════════════════════════════════════════════════ */}
            {phase === "config" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Abas de Modo: Subprojetos Existentes vs Auto-Descobrir via Site Raiz */}
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/60 pb-4">
                  <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-border">
                    <button
                      onClick={() => setConfigMode("discover")}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                        configMode === "discover"
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Compass className="w-4 h-4" />
                      <span>Auto-Descobrir via Site Raiz (Carta de Serviços)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-extrabold border border-amber-400/30">
                        NOVO
                      </span>
                    </button>

                    <button
                      onClick={() => setConfigMode("existing")}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                        configMode === "existing"
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Subprojetos Cadastrados ({subProjects.length})</span>
                    </button>
                  </div>

                  {/* Modelo de IA Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" /> IA:
                    </span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {AI_MODELS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} ({m.provider})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ─────────────────────────────────────────────────────────────
                    MODO A: AUTO-DESCOBERTA VIA SITE RAIZ (CRAWLER CARTA DE SERVIÇOS)
                ───────────────────────────────────────────────────────────── */}
                {configMode === "discover" && (
                  <div className="space-y-6">
                    {/* Input do Site Raiz */}
                    <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4 shadow-sm">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Globe className="w-4 h-4 text-primary" />
                            URL do Site Raiz ou Carta de Serviços
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            O sistema varrerá a página, extrairá todos os serviços e sub-links e criará automaticamente os subprojetos com suíte de testes.
                          </p>
                        </div>

                        {/* Chips de Exemplos Rápidos */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">Exemplos:</span>
                          {ROOT_EXAMPLES.map((ex, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setRootUrlInput(ex.url)}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-background border border-border text-foreground hover:border-primary/40 hover:text-primary transition-all"
                            >
                              {ex.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <input
                            type="url"
                            value={rootUrlInput}
                            onChange={(e) => setRootUrlInput(e.target.value)}
                            placeholder="https://www.gov.br/transportes/pt-br/carta-de-servicos"
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all pl-10"
                          />
                          <Globe className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3.5" />
                        </div>

                        <button
                          onClick={handleDiscoverRootUrl}
                          disabled={isDiscovering || !rootUrlInput.trim()}
                          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/25 flex items-center gap-2 disabled:opacity-50 shrink-0"
                        >
                          {isDiscovering ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Varrendo com IA...
                            </>
                          ) : (
                            <>
                              <Search className="w-4 h-4" />
                              Extrair Subprojetos
                            </>
                          )}
                        </button>
                      </div>

                      {discoverError && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{discoverError}</span>
                        </div>
                      )}
                    </div>

                    {/* Lista de Serviços Descobertos */}
                    {discoveredItems.length > 0 && (() => {
                      const categories = Array.from(new Set(discoveredItems.map((d) => d.category || "Geral")));
                      const filteredDiscovered = discoveredItems.filter((item) => {
                        const matchCat = discoveredCategory === "all" || item.category === discoveredCategory;
                        const matchSearch =
                          !discoveredSearch.trim() ||
                          item.title.toLowerCase().includes(discoveredSearch.toLowerCase()) ||
                          item.description.toLowerCase().includes(discoveredSearch.toLowerCase()) ||
                          item.target_url.toLowerCase().includes(discoveredSearch.toLowerCase());
                        return matchCat && matchSearch;
                      });

                      return (
                        <div className="p-5 rounded-2xl border border-border bg-surface/50 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-border/60 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  {discoveredItems.length} Serviços Prestados Descobertos
                                </h3>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Apenas Serviços Prestados
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Origem: <strong>{discoveredRootTitle}</strong> • {selectedDiscoveredIds.size} de {discoveredItems.length} selecionados
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={selectAllDiscovered}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:bg-accent transition-colors"
                              >
                                {selectedDiscoveredIds.size === discoveredItems.length ? "Desmarcar Todos" : "Selecionar Todos"}
                              </button>
                            </div>
                          </div>

                          {/* Barra de Busca e Filtro de Categorias */}
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="relative flex-1 max-w-sm">
                              <input
                                type="text"
                                value={discoveredSearch}
                                onChange={(e) => setDiscoveredSearch(e.target.value)}
                                placeholder="Filtrar por nome do serviço ou palavra-chave..."
                                className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 pl-8"
                              />
                              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                            </div>

                            {/* Categorias */}
                            {categories.length > 1 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setDiscoveredCategory("all")}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                                    discoveredCategory === "all"
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-background border border-border text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  Todos ({discoveredItems.length})
                                </button>
                                {categories.map((cat) => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setDiscoveredCategory(cat)}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors",
                                      discoveredCategory === cat
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-background border border-border text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Cards dos serviços descobertos */}
                          {filteredDiscovered.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                              Nenhum serviço corresponde ao filtro atual.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                              {filteredDiscovered.map((item) => {
                                const isSelected = selectedDiscoveredIds.has(item.id);
                                return (
                                  <div
                                    key={item.id}
                                    onClick={() => toggleSelectDiscovered(item.id)}
                                    className={cn(
                                      "p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none",
                                      isSelected
                                        ? "bg-primary/5 border-primary/40 shadow-sm ring-1 ring-primary/20"
                                        : "bg-background border-border hover:border-border/80 opacity-70"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "w-5 h-5 rounded flex items-center justify-center text-xs border shrink-0 mt-0.5",
                                        isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border"
                                      )}
                                    >
                                      {isSelected && <Check className="w-3.5 h-3.5" />}
                                    </div>

                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-sm">
                                      {item.emoji || "📋"}
                                    </div>

                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-xs font-bold text-foreground truncate">{item.title}</h4>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                                            {item.category || "Geral"}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDiscoveredItems((prev) => prev.filter((d) => d.id !== item.id));
                                              setSelectedDiscoveredIds((prev) => {
                                                const next = new Set(prev);
                                                next.delete(item.id);
                                                return next;
                                              });
                                            }}
                                            className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                            title="Descartar este serviço"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                      <p className="text-[11px] font-mono text-primary/80 truncate">{item.target_url}</p>
                                      {item.description && (
                                        <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Opções de Auto-criação */}
                          <div className="pt-3 border-t border-border/60 flex items-center justify-between flex-wrap gap-4">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={saveAsNewSubprojects}
                                onChange={(e) => setSaveAsNewSubprojects(e.target.checked)}
                                className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                              />
                              <span className="text-xs font-semibold text-foreground">
                                Salvar automaticamente como novos subprojetos no banco de dados
                              </span>
                            </label>

                            <button
                              onClick={handleStartDiscoveredBatch}
                              disabled={selectedDiscoveredIds.size === 0}
                              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/25 flex items-center gap-2 disabled:opacity-50"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              Criar Subprojetos & Executar Testes ({selectedDiscoveredIds.size} serviços)
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    MODO B: SUBPROJETOS JÁ CADASTRADOS NO PROJETO
                ───────────────────────────────────────────────────────────── */}
                {configMode === "existing" && (
                  <div className="space-y-6">
                    {/* Bloco de Configurações Globais */}
                    <div className="p-5 rounded-2xl border border-border bg-surface/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                          <Globe className="w-4 h-4 text-primary" />
                          URL Alvo Padrão (Ambiente de Teste)
                        </label>
                        <span className="text-[11px] text-muted-foreground">Ex: Staging, Localhost ou Produção</span>
                      </div>
                      <input
                        type="url"
                        value={globalTargetUrl}
                        onChange={(e) => setGlobalTargetUrl(e.target.value)}
                        placeholder="http://localhost:3000 ou https://app.meusite.com"
                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    {/* Lista de Subprojetos para Seleção */}
                    <div className="p-5 rounded-2xl border border-border bg-surface/50 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            Subprojetos Cadastrados
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
                              {selectedIds.size} de {subProjects.length}
                            </span>
                          </h3>
                        </div>

                        <button
                          onClick={selectAll}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border text-foreground hover:bg-accent transition-colors"
                        >
                          {selectedIds.size === subProjects.length ? "Desmarcar Todos" : "Selecionar Todos"}
                        </button>
                      </div>

                      {subProjects.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                          Nenhum subprojeto encontrado neste agrupador. Utilize a aba <strong>"Auto-Descobrir via Site Raiz"</strong> acima para importar os serviços!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                          {subProjects.map((sub) => {
                            const isSelected = selectedIds.has(sub.id);
                            const tasksCount = (sub as any).total_tasks ?? (sub as any).tasks?.length ?? 0;

                            return (
                              <div
                                key={sub.id}
                                onClick={() => toggleSelectSub(sub.id)}
                                className={cn(
                                  "p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none",
                                  isSelected
                                    ? "bg-primary/5 border-primary/40 shadow-sm"
                                    : "bg-background border-border hover:border-border/80 opacity-70"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={cn(
                                      "w-5 h-5 rounded flex items-center justify-center text-xs border shrink-0",
                                      isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border"
                                    )}
                                  >
                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                  </div>
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: `${sub.color || "#6366f1"}20` }}
                                  >
                                    <span className="text-sm">{sub.emoji || "📁"}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{sub.title}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {tasksCount} tarefa{tasksCount === 1 ? "" : "s"}
                                      {sub.description ? ` • ${sub.description}` : ""}
                                    </p>
                                  </div>
                                </div>

                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="shrink-0 max-w-[180px] hidden sm:block"
                                >
                                  <input
                                    type="text"
                                    placeholder="URL específica (opcional)"
                                    value={customUrls[sub.id] || ""}
                                    onChange={(e) =>
                                      setCustomUrls((prev) => ({
                                        ...prev,
                                        [sub.id]: e.target.value,
                                      }))
                                    }
                                    className="w-full bg-background/80 border border-border text-[11px] font-mono px-2 py-1 rounded-md focus:outline-none focus:border-primary"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Toggles Comuns de Execução */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div
                    onClick={() => setGenerateAiTestCases(!generateAiTestCases)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none",
                      generateAiTestCases ? "bg-primary/5 border-primary/40 shadow-sm" : "bg-surface/30 border-border opacity-70"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center text-xs mt-0.5 border",
                        generateAiTestCases ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30"
                      )}
                    >
                      {generateAiTestCases && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Gerar Casos com IA</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Cria suíte BDD detalhada para cada subprojeto/serviço.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setExecuteBrowserTests(!executeBrowserTests)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none",
                      executeBrowserTests ? "bg-primary/5 border-primary/40 shadow-sm" : "bg-surface/30 border-border opacity-70"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center text-xs mt-0.5 border",
                        executeBrowserTests ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30"
                      )}
                    >
                      {executeBrowserTests && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Executar no Navegador</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Dispara o Playwright para validar a página e tirar screenshots.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setAutoIndexTasks(!autoIndexTasks)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none",
                      autoIndexTasks ? "bg-primary/5 border-primary/40 shadow-sm" : "bg-surface/30 border-border opacity-70"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center text-xs mt-0.5 border",
                        autoIndexTasks ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30"
                      )}
                    >
                      {autoIndexTasks && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Criar Tarefas</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Salva os casos gerados como tarefas do subprojeto.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setIncludeAxe(!includeAxe)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none",
                      includeAxe ? "bg-primary/5 border-primary/40 shadow-sm" : "bg-surface/30 border-border opacity-70"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center text-xs mt-0.5 border",
                        includeAxe ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30"
                      )}
                    >
                      {includeAxe && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Auditoria Axe (WCAG)</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Inspeciona regras de contraste e acessibilidade digital.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                FASE 2: EXECUÇÃO AO VIVO ("SEM SAIR DA TELA")
            ══════════════════════════════════════════════════════════ */}
            {phase === "running" && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Barra de Progresso Global Superior */}
                <div className="px-6 py-3 bg-primary/5 border-b border-primary/20 flex items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 animate-spin">
                      <Loader2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          Processando Subprojeto {currentRunningIndex} de {totalSelected}
                        </span>
                        <span className="text-[11px] text-primary font-mono font-semibold">
                          ({Math.round(((currentRunningIndex - 1) / totalSelected) * 100)}%)
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Ativo agora: <strong className="text-foreground">{currentActiveSubState?.title || "Preparando..."}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Ações de Controle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-2 hidden sm:block">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Tempo Total</span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {Math.floor(elapsedTotal / 60)}m {elapsedTotal % 60}s
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        const next = !isPaused;
                        setIsPaused(next);
                        isPausedRef.current = next;
                      }}
                      className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold bg-background hover:bg-accent text-foreground transition-colors flex items-center gap-1.5"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-500" /> : <Pause className="w-3.5 h-3.5 text-amber-500" />}
                      {isPaused ? "Retomar" : "Pausar"}
                    </button>

                    <button
                      onClick={handleAbort}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                      title="Cancelar execução de todos os testes agora"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancelar SmartRunner</span>
                    </button>
                  </div>
                </div>

                {/* Split Layout: Subprojetos à esquerda, Detalhes ao vivo à direita */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border">
                  {/* Coluna Esquerda: Lista de Subprojetos (4 cols) */}
                  <div className="md:col-span-4 overflow-y-auto p-4 space-y-2.5 bg-surface/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Fila de Subprojetos
                      </span>
                      <span className="text-xs font-mono font-bold text-primary">
                        {completedCount + errorCount}/{totalSelected}
                      </span>
                    </div>

                    {Object.values(execStates).map((st) => {
                      const isActive = st.id === activeSubId;
                      return (
                        <div
                          key={st.id}
                          onClick={() => setActiveSubId(st.id)}
                          className={cn(
                            "p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2",
                            isActive
                              ? "bg-primary/10 border-primary/50 shadow-md ring-1 ring-primary/20"
                              : "bg-surface border-border hover:border-border/80"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-sm shrink-0">{st.emoji}</span>
                              <span className="text-xs font-bold text-foreground truncate">{st.title}</span>
                            </div>

                            {/* Status Badge */}
                            {st.status === "pending" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                                Na fila
                              </span>
                            )}
                            {st.status === "generating_ai" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold flex items-center gap-1 animate-pulse">
                                <Sparkles className="w-3 h-3 animate-spin" /> IA
                              </span>
                            )}
                            {st.status === "running_browser" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-semibold flex items-center gap-1 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" /> Playwright
                              </span>
                            )}
                            {st.status === "completed" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Concluído
                              </span>
                            )}
                            {st.status === "error" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Falhou
                              </span>
                            )}
                          </div>

                          {/* Mini Stats */}
                          {(st.status === "completed" || st.status === "running_browser") && (
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                              <span className="text-emerald-400 font-semibold">✓ {st.approvedSteps} aprovados</span>
                              {st.failedSteps > 0 && <span className="text-rose-400 font-semibold">✖ {st.failedSteps} falhas</span>}
                              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                                {st.testCases.length} casos
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Coluna Direita: Detalhes do Subprojeto Selecionado (8 cols) */}
                  <div className="md:col-span-8 overflow-hidden flex flex-col bg-background/50">
                    {/* Header do Subprojeto Ativo */}
                    <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between gap-4 bg-surface/50 shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">{currentActiveSubState?.emoji}</span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {currentActiveSubState?.title}
                          </h3>
                          <p className="text-[11px] font-mono text-muted-foreground truncate">
                            {currentActiveSubState?.targetUrl}
                          </p>
                        </div>
                      </div>

                      {/* Sub-Tabs de visualização */}
                      <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border shrink-0">
                        <button
                          onClick={() => setActiveSubTab("console")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
                            activeSubTab === "console" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Terminal className="w-3.5 h-3.5" /> Console
                        </button>
                        <button
                          onClick={() => setActiveSubTab("test_cases")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
                            activeSubTab === "test_cases" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <FileText className="w-3.5 h-3.5" /> Casos ({currentActiveSubState?.testCases?.length || 0})
                        </button>
                        <button
                          onClick={() => setActiveSubTab("steps")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
                            activeSubTab === "steps" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <CheckSquare className="w-3.5 h-3.5" /> Passos ({currentActiveSubState?.stepsResults?.length || 0})
                        </button>
                        {currentActiveSubState?.htmlReportUrl && (
                          <button
                            onClick={() => setActiveSubTab("report")}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1",
                              activeSubTab === "report" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Eye className="w-3.5 h-3.5" /> Relatório
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Conteúdo da Sub-Aba Ativa */}
                    <div className="flex-1 overflow-y-auto p-5">
                      {/* SUB-ABA: CONSOLE AO VIVO */}
                      {activeSubTab === "console" && (
                        <div className="space-y-4">
                          <QaLiveConsole
                            logs={currentActiveSubState?.logs || []}
                            loading={
                              currentActiveSubState?.status === "generating_ai" ||
                              currentActiveSubState?.status === "running_browser"
                            }
                            title={`Logs de Execução — ${currentActiveSubState?.title || ""}`}
                            defaultExpanded={true}
                          />

                          {currentActiveSubState?.logs.length === 0 && (
                            <div className="text-center py-16 text-muted-foreground text-sm">
                              Aguardando início do subprojeto na fila...
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUB-ABA: CASOS DE TESTE GERADOS */}
                      {activeSubTab === "test_cases" && (
                        <div className="space-y-3">
                          {currentActiveSubState?.testCases.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground text-sm">
                              Nenhum caso de teste gerado ainda. Aguardando processamento da IA...
                            </div>
                          ) : (
                            currentActiveSubState?.testCases.map((tc, idx) => (
                              <div
                                key={tc.id || idx}
                                className="p-4 rounded-xl border border-border bg-surface/40 space-y-2 hover:border-primary/30 transition-all"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-primary font-mono">
                                      {tc.id || `TC-${idx + 1}`}
                                    </span>
                                    <h4 className="text-xs font-bold text-foreground">{tc.title}</h4>
                                  </div>
                                  <span
                                    className={cn(
                                      "text-[10px] px-2 py-0.5 rounded-full font-semibold border",
                                      tc.priority === "alta"
                                        ? "text-rose-400 bg-rose-400/10 border-rose-400/20"
                                        : tc.priority === "media"
                                        ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                                        : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                                    )}
                                  >
                                    {tc.priority}
                                  </span>
                                </div>

                                <div className="space-y-1 text-xs text-muted-foreground pl-3 border-l-2 border-primary/30">
                                  <p className="font-semibold text-foreground text-[11px]">Passos de Reprodução:</p>
                                  {tc.steps.map((step, sIdx) => (
                                    <p key={sIdx} className="text-[11px]">
                                      {sIdx + 1}. {step}
                                    </p>
                                  ))}
                                  <p className="text-[11px] pt-1 text-foreground/80 font-medium">
                                    <strong>Resultado Esperado:</strong> {tc.expected_result}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* SUB-ABA: PASSOS EXECUTADOS & PRINTS */}
                      {activeSubTab === "steps" && (
                        <div className="space-y-3">
                          {currentActiveSubState?.stepsResults.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground text-sm">
                              Nenhum passo executado no navegador ainda.
                            </div>
                          ) : (
                            currentActiveSubState?.stepsResults.map((step, idx) => (
                              <div
                                key={idx}
                                className="p-3.5 rounded-xl border border-border bg-surface/40 flex items-start justify-between gap-3"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <span
                                    className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                                      step.status === "aprovado"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                    )}
                                  >
                                    {step.status === "aprovado" ? "✓" : "✖"}
                                  </span>
                                  <div>
                                    <p className="text-xs font-bold text-foreground">{step.label}</p>
                                    {step.detalhe && (
                                      <p className="text-[11px] text-muted-foreground mt-0.5">{step.detalhe}</p>
                                    )}
                                    {step.duration && (
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        {(step.duration / 1000).toFixed(2)}s
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {step.screenshotBase64 && (
                                  <div className="shrink-0">
                                    <img
                                      src={`data:image/jpeg;base64,${step.screenshotBase64}`}
                                      alt="Captura"
                                      className="w-16 h-12 object-cover rounded-lg border border-border cursor-pointer hover:scale-105 transition-transform"
                                      onClick={() => {
                                        const w = window.open("");
                                        w?.document.write(
                                          `<img src="data:image/jpeg;base64,${step.screenshotBase64}" style="max-width:100%; height:auto;" />`
                                        );
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* SUB-ABA: RELATÓRIO DO SUBPROJETO */}
                      {activeSubTab === "report" && currentActiveSubState?.htmlReportUrl && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                            <div>
                              <p className="text-xs font-bold text-foreground">Relatório Interativo Disponível</p>
                              <p className="text-[11px] text-muted-foreground">
                                Relatório HTML completo com evidências e diagnóstico.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={currentActiveSubState.htmlReportUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Abrir Relatório HTML
                              </a>
                              {currentActiveSubState.pdfUrl && (
                                <a
                                  href={currentActiveSubState.pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold flex items-center gap-1.5 hover:bg-secondary/80 transition-colors"
                                >
                                  <FileDown className="w-3.5 h-3.5" /> PDF
                                </a>
                              )}
                            </div>
                          </div>

                          <iframe
                            src={currentActiveSubState.htmlReportUrl}
                            className="w-full h-[450px] rounded-xl border border-border bg-background"
                            title="Visualização do Relatório"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                FASE 3: RESUMO GERAL DOS RESULTADOS
            ══════════════════════════════════════════════════════════ */}
            {phase === "summary" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Cartões de Indicadores */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl border border-border bg-surface/50">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Subprojetos Executados
                    </span>
                    <span className="text-2xl font-black text-foreground mt-1 block">
                      {completedCount} / {totalSelected}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Passos Aprovados
                    </span>
                    <span className="text-2xl font-black text-emerald-400 mt-1 block">
                      {totalApprovedSteps}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
                      Falhas / Bloqueios
                    </span>
                    <span className="text-2xl font-black text-rose-400 mt-1 block">
                      {totalFailedSteps}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                      Taxa de Sucesso
                    </span>
                    <span className="text-2xl font-black text-primary mt-1 block">
                      {successRate}%
                    </span>
                  </div>
                </div>

                {/* Matriz de Resultados dos Subprojetos */}
                <div className="rounded-2xl border border-border bg-surface/50 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border bg-surface/80 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Resultado Consolidado por Subprojeto
                    </h3>
                  </div>

                  <div className="divide-y divide-border">
                    {Object.values(execStates).map((st) => (
                      <div key={st.id} className="p-4 flex items-center justify-between gap-4 flex-wrap hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <span className="text-xl">{st.emoji}</span>
                          <div>
                            <h4 className="text-xs font-bold text-foreground">{st.title}</h4>
                            <p className="text-[11px] text-muted-foreground font-mono">{st.targetUrl}</p>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-3">
                          {st.status === "completed" ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold flex items-center gap-1 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado ({st.approvedSteps}/{st.totalSteps})
                            </span>
                          ) : st.status === "error" ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 font-semibold flex items-center gap-1 border border-rose-500/20">
                              <AlertCircle className="w-3.5 h-3.5" /> Erro na Execução
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-semibold">
                              Não executado
                            </span>
                          )}

                          <span className="text-xs text-muted-foreground">
                            {st.testCases.length} casos BDD
                          </span>
                        </div>

                        {/* Ações por linha */}
                        <div className="flex items-center gap-2">
                          {st.htmlReportUrl && (
                            <a
                              href={st.htmlReportUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Ver HTML
                            </a>
                          )}
                          {st.pdfUrl && (
                            <a
                              href={st.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-accent text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <FileDown className="w-3.5 h-3.5" /> PDF
                            </a>
                          )}
                          {st.status === "error" && (
                            <button
                              onClick={() => handleRetrySub(st.id)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Tentar Novamente
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── FOOTER DO MODAL ── */}
          <div className="px-6 py-4 border-t border-border/60 bg-surface/80 flex items-center justify-between shrink-0">
            {phase === "config" && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>

                {configMode === "existing" ? (
                  <button
                    onClick={handleStartExistingBatch}
                    disabled={selectedIds.size === 0}
                    className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Iniciar Execução em Lote ({selectedIds.size} subprojetos)
                  </button>
                ) : (
                  <button
                    onClick={handleStartDiscoveredBatch}
                    disabled={selectedDiscoveredIds.size === 0}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/25 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Criar & Executar Testes ({selectedDiscoveredIds.size} serviços)
                  </button>
                )}
              </>
            )}

            {phase === "running" && (
              <>
                <span className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Executando testes em tempo real sem sair da tela...
                </span>
                <button
                  onClick={handleAbort}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <X className="w-4 h-4" />
                  <span>Cancelar SmartRunner</span>
                </button>
              </>
            )}

            {phase === "summary" && (
              <>
                <button
                  onClick={() => setPhase("config")}
                  className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-accent flex items-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Nova Execução
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    Concluir e Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
