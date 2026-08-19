"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, CheckSquare, Circle, Clock, XCircle, Sparkles, Maximize2, Play, Code2, FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn, getPriorityColor, getPriorityLabel, getStatusLabel, formatDate } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { TaskDetailPane } from "./TaskDetailPane";

interface TaskPanelProps {
  tasks: Task[];
  projectId: string;
  projectUrl?: string;
  onTasksChange: (tasks: Task[]) => void;
}

const STATUS_ICON: Record<TaskStatus, React.ElementType> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckSquare,
  cancelled: XCircle,
};

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
  cancelled: "todo",
};

export function TaskPanel({ tasks, projectId, onTasksChange, projectUrl }: TaskPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeTaskId = searchParams.get("taskId");

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [subtaskFormId, setSubtaskFormId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<TaskStatus | "">("");
  const [bulkPriority, setBulkPriority] = useState<TaskPriority | "">("");
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, title: "", action: "Executando" });
  const [generatingTasksPdf, setGeneratingTasksPdf] = useState(false);
  const [isGeneratingPlans, setIsGeneratingPlans] = useState(false);
  const [planProgress, setPlanProgress] = useState("");
  const [manualTaskModal, setManualTaskModal] = useState<{
    task: Task;
    errorMsg?: string;
    targetUrl?: string;
  } | null>(null);
  const [manualEvidence, setManualEvidence] = useState<string | null>(null);

  // Helper para extrair número do TC para ordenação estrita (TC001 -> 1, TC002 -> 2)
  const extractTcNumber = (title: string): number => {
    const match = title.match(/(?:TC|CT|TESTE)[\s_-]?(\d+)/i);
    return match ? parseInt(match[1], 10) : 999999;
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) =>
      filterStatus === "all" ? true : t.status === filterStatus
    );
  }, [tasks, filterStatus]);

  const sortedParentTasks = useMemo(() => {
    const parentList = filteredTasks.filter(
      (t) => !t.parent_task_id || !tasks.some((p) => p.id === t.parent_task_id)
    );
    return parentList.sort((a, b) => {
      const numA = extractTcNumber(a.title);
      const numB = extractTcNumber(b.title);
      if (numA !== numB) return numA - numB;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [filteredTasks, tasks]);

  const generateBulkAutomation = async () => {
    const ids = Array.from(selectedTasks);
    if (ids.length === 0) return;
    
    const tasksToGenerate = ids.map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[];
    if (tasksToGenerate.length === 0) return;

    setIsBatchRunning(true);
    let current = 0;
    const total = tasksToGenerate.length;
    const supabase = createClient();
    let updatedTasks = [...tasks];

    for (const task of tasksToGenerate) {
      current++;
      setBatchProgress({ current, total, title: task.title, action: "Gerando" });
      
      try {
        const res = await fetch("/api/ai/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool_type: "automation",
            input: `Título da Tarefa: ${task.title}\n\nDescrição e Passos:\n${task.description || ""}`,
            model: "auto-free",
            project_id: projectId
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.result) {
            const codeBlock = data.result.includes("```") ? data.result : `\`\`\`javascript\n${data.result}\n\`\`\``;
            const newMetadata = { ...(task.metadata || {}), automationCode: codeBlock };
            
            updatedTasks = updatedTasks.map(t => t.id === task.id ? { ...t, metadata: newMetadata } : t);
            onTasksChange(updatedTasks);
            await supabase.from("tasks").update({ metadata: newMetadata, updated_at: new Date().toISOString() }).eq("id", task.id);
          }
        }
      } catch (e) {
        // Ignora e continua
      }
    }
    
    setIsBatchRunning(false);
    setBatchProgress({ current: 0, total: 0, title: "", action: "Executando" });
    setSelectedTasks(new Set());
  };

  const generateBulkTestPlans = async (targetTasksList?: Task[]) => {
    const list = targetTasksList || (selectedTasks.size > 0 ? tasks.filter(t => selectedTasks.has(t.id)) : tasks);
    if (list.length === 0) {
      alert("Nenhum caso de teste disponível para gerar o plano.");
      return;
    }

    setIsGeneratingPlans(true);
    const supabase = createClient();
    let currentTasks = [...tasks];
    let count = 0;

    for (const task of list) {
      count++;
      setPlanProgress(`Gerando plano de teste ${count}/${list.length}: ${task.title.slice(0, 30)}...`);

      try {
        const res = await fetch("/api/ai/task-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskTitle: task.title,
            projectTitle: projectUrl || "Sistema Web",
            projectUrl: projectUrl || "",
            currentDescription: task.description || "",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.plan) {
            currentTasks = currentTasks.map(t => t.id === task.id ? { ...t, description: data.plan } : t);
            onTasksChange(currentTasks);
            await supabase.from("tasks").update({ description: data.plan, updated_at: new Date().toISOString() }).eq("id", task.id);
          }
        }
      } catch (err) {
        console.warn("Falha ao gerar plano para tarefa:", task.title, err);
      }
    }

    setIsGeneratingPlans(false);
    setPlanProgress("");
    setSelectedTasks(new Set());
  };

  const downloadTasksPdf = async () => {
    const ids = Array.from(selectedTasks);
    if (ids.length === 0) return;
    const rawTasks = ids.map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[];
    if (rawTasks.length === 0) return;

    // Ordenação estritamente crescente: TC001, TC002, TC003, ...
    const tasksToExport = [...rawTasks].sort((a, b) => {
      const numA = extractTcNumber(a.title);
      const numB = extractTcNumber(b.title);
      if (numA !== numB) return numA - numB;
      return a.title.localeCompare(b.title, undefined, { numeric: true });
    });

    setGeneratingTasksPdf(true);
    try {
      const statusLabel: Record<string, string> = { todo: 'A Fazer', in_progress: 'Em Progresso', done: 'Concluída', cancelled: 'Cancelada' };
      const priorityLabel: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

      // Tenta buscar relatórios recentes do projeto e do usuário no banco para vincular evidências e capturas automaticamente
      let projectReports: any[] = [];
      try {
        const supabase = createClient();
        const { data: repData } = await supabase
          .from('qa_reports')
          .select('id, title, project_id, type, result_json, result_raw, created_at')
          .order('created_at', { ascending: false })
          .limit(100);
        if (repData) projectReports = repData;
      } catch (err) {
        console.warn('Falha ao buscar relatórios vinculados:', err);
      }

      const tasksContent = tasksToExport
        .map((t, i) => [
          `## ${i + 1}. ${t.title}`,
          `**Status:** ${statusLabel[t.status] || t.status} | **Prioridade:** ${priorityLabel[t.priority] || t.priority}`,
          t.description ? `\n**Descrição / Plano:**\n${t.description}` : '',
        ].filter(Boolean).join('\n'))
        .join('\n\n---\n\n');

      let content = '';
      try {
        const res = await fetch('/api/ai/qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool_type: 'consolidated_report',
            input: [
              `Você receberá ${tasksToExport.length} tarefa(s) de um projeto. Gere um Relatório Executivo Consolidado de Testes em português contendo:`,
              `1. **Sumário Executivo** — visão geral das tarefas, status geral e cobertura`,
              `2. **Tabela de Tarefas** — lista com número, título, status, prioridade e observações`,
              `3. **Detalhamento por Tarefa** — para cada tarefa: objetivo, passos do plano e resultado esperado`,
              `4. **Métricas** — distribuição por status e prioridade`,
              `5. **Recomendações e Próximos Passos** — o que precisa ser corrigido e priorizações`,
              ``,
              `Use formatação rica em Markdown com títulos (#, ##, ###), tabelas, listas e negrito. Seja detalhado e profissional.`,
              ``,
              `--- TAREFAS SELECIONADAS ---`,
              ``,
              tasksContent,
            ].join('\n'),
            model: 'auto-free',
            project_id: projectId,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          content = data.result || data.report?.result_raw || '';
        }
      } catch (aiErr) {
        console.warn('Erro ao chamar IA, usando fallback estruturado:', aiErr);
      }

      // Fallback estruturado caso a IA falhe ou demore
      if (!content) {
        const total = tasksToExport.length;
        const done = tasksToExport.filter(t => t.status === 'done').length;
        const inProgress = tasksToExport.filter(t => t.status === 'in_progress').length;
        const todo = tasksToExport.filter(t => t.status === 'todo').length;

        content = [
          `# Sumário Executivo`,
          `Relatório consolidado de **${total}** tarefas selecionadas do projeto. Foram identificadas **${done}** tarefas concluídas, **${inProgress}** em progresso e **${todo}** a fazer.`,
          ``,
          `## Tabela de Tarefas`,
          `| # | Tarefa | Status | Prioridade |`,
          `|---|---|---|---|`,
          ...tasksToExport.map((t, idx) => `| ${idx + 1} | ${t.title} | ${statusLabel[t.status] || t.status} | ${priorityLabel[t.priority] || t.priority} |`),
          ``,
          `## Detalhamento das Tarefas`,
          ...tasksToExport.map((t, idx) => [
            `### ${idx + 1}. ${t.title}`,
            `- **Status:** ${statusLabel[t.status] || t.status}`,
            `- **Prioridade:** ${priorityLabel[t.priority] || t.priority}`,
            t.description ? `\n**Plano / Descrição:**\n${t.description}` : '\n*Sem descrição detalhada cadastrada.*',
            ``,
          ].join('\n')),
          `## Métricas Gerais`,
          `- **Taxa de Conclusão:** ${total > 0 ? Math.round((done / total) * 100) : 0}%`,
          `- **Tarefas Críticas/Alta Prioridade:** ${tasksToExport.filter(t => t.priority === 'high' || t.priority === 'urgent').length}`,
        ].join('\n');
      }

      const now = new Date().toLocaleString('pt-BR');
      
      // Helper para garantir que qualquer string Base64 ou URL tenha o prefixo correto de imagem
      const toDataUri = (img: string | undefined | null): string => {
        if (!img) return '';
        const trimmed = String(img).trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
          return trimmed;
        }
        if (trimmed.startsWith('iVBOR')) {
          return `data:image/png;base64,${trimmed}`;
        }
        return `data:image/jpeg;base64,${trimmed}`;
      };

      // Helper para extrair código único do caso de teste (ex: "TC001", "TC006")
      const extractTcCode = (str: string): string | null => {
        if (!str) return null;
        const match = str.match(/(?:TC|CT|TESTE)[\s_-]?(\d+)/i);
        return match ? `TC${match[1].padStart(3, '0')}` : null;
      };

      // Helper para extrair passos textuais da descrição da própria tarefa
      const extractStepsFromDescription = (desc: string) => {
        if (!desc) return [];
        const lines = desc.split('\n');
        const steps: Array<{ index: number; label: string; detalhe?: string }> = [];
        let isInsideSteps = false;

        for (const line of lines) {
          const trimmed = line.trim();
          if (/passos|steps|procedimento/i.test(trimmed)) {
            isInsideSteps = true;
            continue;
          }
          if (isInsideSteps && /^#{1,4}\s+|^\*\*(?:resultado|crit[ée]rio|pre-condi)/i.test(trimmed)) {
            isInsideSteps = false;
          }

          const stepMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)$/);
          if (stepMatch && (isInsideSteps || steps.length > 0)) {
            steps.push({
              index: steps.length + 1,
              label: stepMatch[2].replace(/\*\*/g, '').trim(),
            });
          }
        }
        return steps;
      };

      // Helper para gerar assinatura de imagem e evitar prints duplicados
      const getImageFingerprint = (img: string | undefined | null): string => {
        if (!img) return '';
        const trimmed = String(img).trim();
        return `${trimmed.length}_${trimmed.slice(60, 140)}_${trimmed.slice(-60)}`;
      };

      // Constrói os cards detalhados de cada tarefa selecionada com todas as suas evidências
      const tasksCardsHtml = tasksToExport.map((t, idx) => {
        const meta = (t.metadata || {}) as Record<string, any>;
        const taskTcCode = extractTcCode(t.title);
        const seenFingerprints = new Set<string>();
        
        // 1. Evidência direta na tarefa
        let rawEvidence = meta.evidence as string | undefined;
        const lastRun = meta.lastRunResult as Record<string, any> | undefined;
        const autoCode = meta.automationCode as string | undefined;

        // 2. Extrai imagens embutidas em markdown na descrição
        if (!rawEvidence && t.description) {
          const mdImgMatch = t.description.match(/!\[.*?\]\((https?:\/\/[^\s\)]+|data:image\/[^\s\)]+)\)/);
          if (mdImgMatch) rawEvidence = mdImgMatch[1];
        }

        // 3. Matching rigoroso com relatórios do projeto: apenas se o TC coincidir ou o título for idêntico
        let matchedReportSteps = (lastRun?.steps || []) as any[];
        let rawFinalScreenshot = lastRun?.finalScreenshot;

        if (matchedReportSteps.length === 0 && projectReports.length > 0) {
          const matchedRep = projectReports.find(r => {
            const repTitle = r.title || '';
            const repJobName = r.result_json?.jobName || '';
            const repTcCode = extractTcCode(repTitle) || extractTcCode(repJobName);

            // Match 1: Código TC idêntico (ex: TC006 === TC006)
            if (taskTcCode && repTcCode && taskTcCode === repTcCode) return true;

            // Match 2: Título exato limpo
            const cleanTaskTitle = t.title.replace(/^\[QA\]\s*/i, '').toLowerCase().trim();
            const cleanRepTitle = repTitle.replace(/^(?:Auditoria IA:\s*|\[QA\]\s*)/i, '').toLowerCase().trim();
            return cleanTaskTitle.length > 5 && cleanRepTitle.includes(cleanTaskTitle);
          });

          if (matchedRep?.result_json) {
            matchedReportSteps = matchedRep.result_json.steps || [];
            rawFinalScreenshot = matchedRep.result_json.finalScreenshot;
            if (!rawEvidence && rawFinalScreenshot) {
              rawEvidence = rawFinalScreenshot;
            }
          }
        }

        // 4. Se não há execução de runner Playwright gravada, extrai os passos da própria descrição da tarefa
        const parsedDescSteps = matchedReportSteps.length === 0 ? extractStepsFromDescription(t.description || '') : [];

        const evidenceImg = toDataUri(rawEvidence);
        if (evidenceImg) {
          seenFingerprints.add(getImageFingerprint(evidenceImg));
        }

        const finalScreenshotImg = toDataUri(rawFinalScreenshot);

        const statusMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
          done: { label: 'Concluído / Aprovado', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)' },
          in_progress: { label: 'Em Progresso', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' },
          todo: { label: 'A Fazer / Pendente', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.25)' },
          cancelled: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)' },
        };
        const sInfo = statusMap[t.status] || statusMap.todo;

        const priorityMap: Record<string, { label: string; color: string }> = {
          urgent: { label: 'URGENTE', color: '#f43f5e' },
          high: { label: 'ALTA', color: '#fb7185' },
          medium: { label: 'MÉDIA', color: '#fbbf24' },
          low: { label: 'BAIXA', color: '#34d399' },
        };
        const pInfo = priorityMap[t.priority] || priorityMap.medium;

        const displayTcCode = taskTcCode || `TC-${String(idx + 1).padStart(3, '0')}`;

        return `
        <div class="test-card" data-status="${t.status}" id="task-${idx + 1}">
          <div class="test-header">
            <div class="test-title-wrapper">
              <span class="test-index">${displayTcCode}</span>
              <h2 class="test-title" contenteditable="true">${t.title}</h2>
            </div>
            <div class="test-badges">
              <span class="badge" style="color:${pInfo.color}; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15);">
                PRIORIDADE: ${pInfo.label}
              </span>
              <span class="badge" style="color:${sInfo.color}; background:${sInfo.bg}; border:1px solid ${sInfo.border};">
                ${sInfo.label}
              </span>
            </div>
          </div>

          <div class="test-body">
            <!-- Descrição e Plano de Teste -->
            <div class="section-block">
              <h3 class="section-title">📋 Especificação e Plano de Teste</h3>
              <div class="description-box" contenteditable="true">
                ${t.description 
                  ? t.description
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n\n/g, '</p><p>')
                      .replace(/\n/g, '<br/>')
                  : '<em style="color:#64748b;">Nenhum detalhamento textual informado.</em>'
                }
              </div>
            </div>

            <!-- Evidência Anexada ou Captura do Teste -->
            <div class="section-block evidence-section">
              <div class="section-header-flex" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <h3 class="section-title">📸 Registro de Evidência & Prova de Execução</h3>
                <button class="img-edit-btn add-btn" onclick="window.triggerImageUpload(this.closest('.evidence-section'))" title="Anexar ou trocar imagem">
                  📷 Trocar / Anexar Imagem
                </button>
              </div>
              ${evidenceImg ? `
                <div class="evidence-preview-wrapper" onclick="window.openLightboxFromEl(this)">
                  <img src="${evidenceImg}" alt="Evidência" class="evidence-img" />
                  <div class="img-overlay">
                    <span>🔍 Clique para zoom &bull; Pressione Ctrl+V ou use os botões para trocar</span>
                  </div>
                  <div class="img-action-bar" onclick="event.stopPropagation()">
                    <button class="img-action-pill" onclick="window.triggerImageUpload(this.closest('.evidence-section'))" title="Trocar imagem">📷 Trocar</button>
                    <button class="img-action-pill danger" onclick="window.removeCardImage(this)" title="Remover imagem">🗑️ Remover</button>
                  </div>
                </div>
              ` : `
                <div class="evidence-audit-badge" onclick="window.triggerImageUpload(this.closest('.evidence-section'))" title="Clique ou pressione Ctrl+V para anexar um print">
                  <div class="audit-icon">🛡️</div>
                  <div class="audit-details">
                    <p class="audit-title">Evidência Registrada no Sistema de QA</p>
                    <p class="audit-desc">Status da Tarefa: <strong>${sInfo.label}</strong> &bull; Prioridade: <strong>${pInfo.label}</strong></p>
                    <p class="audit-date">Registro validado em: ${now} &bull; <span style="color:#818cf8; text-decoration:underline;">Clique para anexar print</span></p>
                  </div>
                  <span class="audit-tag">CONFORME QA</span>
                </div>
              `}
            </div>

            <!-- Passos da Execução de Automação Playwright (com deduplicação inteligente de telas) -->
            ${matchedReportSteps.length > 0 ? `
              <div class="section-block">
                <h3 class="section-title">⚡ Evidências da Execução Automatizada (${matchedReportSteps.length} Passos)</h3>
                <div class="steps-grid">
                  ${matchedReportSteps.map((step: any, sIdx: number) => {
                    const isOk = step.status === 'aprovado';
                    const rawStepImg = toDataUri(step.screenshotBase64 || step.screenshotElementBase64);
                    const fp = getImageFingerprint(rawStepImg);
                    
                    // Se a imagem for idêntica a uma já exibida, não duplica no passo
                    const isDuplicate = !fp || seenFingerprints.has(fp);
                    if (fp && !isDuplicate) {
                      seenFingerprints.add(fp);
                    }
                    const stepImg = isDuplicate ? '' : rawStepImg;

                    return `
                      <div class="step-item ${isOk ? 'step-ok' : 'step-fail'}" tabindex="0" onpaste="window.handleStepPaste(event, this)">
                        <div class="step-header">
                          <span class="step-badge">${sIdx + 1}</span>
                          <span class="step-label" contenteditable="true">${step.label}</span>
                          <span class="step-status ${isOk ? 'status-ok' : 'status-fail'}" contenteditable="true">
                            ${isOk ? '✓ APROVADO' : '✖ FALHOU'}
                          </span>
                        </div>
                        ${step.detalhe ? `<p class="step-detail" contenteditable="true">${step.detalhe}</p>` : ''}
                        <div class="step-img-container">
                          ${stepImg ? `
                            <div class="step-img-box" onclick="window.openLightboxFromEl(this)">
                              <img src="${stepImg}" alt="Screenshot do Passo" />
                              <span class="zoom-tag">🔍 Zoom</span>
                              <div class="step-img-actions" onclick="event.stopPropagation()">
                                <button onclick="window.triggerStepImageUpload(this)" title="Trocar imagem">📷</button>
                                <button class="danger" onclick="window.removeStepImage(this)" title="Remover imagem">🗑️</button>
                              </div>
                            </div>
                          ` : `
                            <div class="step-img-empty" onclick="window.triggerStepImageUpload(this)">
                              <span>➕ Anexar print (ou Ctrl+V)</span>
                            </div>
                          `}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : parsedDescSteps.length > 0 ? `
              <!-- Passos Extraídos do Roteiro Cadastrado para Esta Tarefa -->
              <div class="section-block">
                <h3 class="section-title">📝 Roteiro de Passos do Teste (${parsedDescSteps.length} Passos)</h3>
                <div class="steps-grid">
                  ${parsedDescSteps.map((step, sIdx) => `
                    <div class="step-item step-ok" tabindex="0" onpaste="window.handleStepPaste(event, this)">
                      <div class="step-header">
                        <span class="step-badge">${sIdx + 1}</span>
                        <span class="step-label" contenteditable="true">${step.label}</span>
                        <span class="step-status status-ok" contenteditable="true">ESPECIFICADO</span>
                      </div>
                      <div class="step-img-container">
                        <div class="step-img-empty" onclick="window.triggerStepImageUpload(this)">
                          <span>➕ Anexar print (ou Ctrl+V)</span>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Screenshot Final do Navegador (Apenas se for visualmente diferente das já exibidas) -->
            ${finalScreenshotImg && !seenFingerprints.has(getImageFingerprint(finalScreenshotImg)) ? `
              <div class="section-block">
                <h3 class="section-title">🏁 Captura Final do Navegador</h3>
                <div class="evidence-preview-wrapper" onclick="window.openLightboxFromEl(this)">
                  <img src="${finalScreenshotImg}" alt="Captura Final" class="evidence-img" />
                  <div class="img-overlay"><span>🔍 Clique para expandir</span></div>
                </div>
              </div>
            ` : ''}

            <!-- Código de Automação Playwright -->
            ${autoCode ? `
              <div class="section-block">
                <h3 class="section-title">💻 Script Playwright Gerado</h3>
                <pre class="code-box"><code>${autoCode.replace(/```(?:javascript|typescript)?\n?/g, '').trim()}</code></pre>
              </div>
            ` : ''}
          </div>
        </div>
        `;
       }).join('\n');

      const totalCount = tasksToExport.length;
      const doneCount = tasksToExport.filter(t => t.status === 'done').length;
      const inProgressCount = tasksToExport.filter(t => t.status === 'in_progress').length;
      const todoCount = tasksToExport.filter(t => t.status === 'todo').length;
      const successRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório Executivo de QA & Testes — ${now}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
    
    :root {
      --bg: #071224;
      --card-bg: #0d1b33;
      --card-border: rgba(255, 255, 255, 0.1);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #1351b4;
      --primary-light: #5992ed;
      --success: #168821;
      --warning: #ffcd07;
      --danger: #e52207;
      --code-bg: #050c18;
    }

    [data-theme="light"] {
      --bg: #f4f6f9;
      --card-bg: #ffffff;
      --card-border: #d1d5db;
      --text: #1f2937;
      --text-muted: #4b5563;
      --primary: #1351b4;
      --primary-light: #1351b4;
      --success: #168821;
      --warning: #c2850c;
      --danger: #e52207;
      --code-bg: #f3f4f6;
    }
    [data-theme="light"] .top-toolbar { background: #ffffff !important; border-color: #d1d5db !important; }
    [data-theme="light"] .brand-tag { color: #111827 !important; }
    [data-theme="light"] .btn { background: #f3f4f6 !important; color: #111827 !important; border-color: #d1d5db !important; }
    [data-theme="light"] .btn:hover { background: #e5e7eb !important; }
    [data-theme="light"] .description-box { background: #f9fafb !important; border-color: #e5e7eb !important; color: #374151 !important; }
    [data-theme="light"] .step-item { background: #ffffff !important; border-color: #e5e7eb !important; }
    [data-theme="light"] .evidence-audit-badge { background: #f0fdf4 !important; border-color: #bbf7d0 !important; color: #166534 !important; }
    [data-theme="light"] .search-input { background: #ffffff !important; color: #111827 !important; border-color: #d1d5db !important; }
    [data-theme="light"] .pill-btn { background: #ffffff !important; color: #4b5563 !important; border-color: #d1d5db !important; }
    [data-theme="light"] .pill-btn.active { background: #1351b4 !important; color: #ffffff !important; border-color: #1351b4 !important; }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Raleway', -apple-system, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.6; transition: background 0.25s, color 0.25s; padding-bottom: 80px; }

    /* Top Control Bar */
    .top-toolbar { position: sticky; top: 0; z-index: 999999; background: #071224; border-bottom: 2px solid #1351b4; padding: 12px 32px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .toolbar-left { display: flex; align-items: center; gap: 12px; }
    .brand-tag { font-weight: 800; font-size: 14px; color: #fff; display: flex; align-items: center; gap: 8px; letter-spacing: -0.3px; }
    .brand-tag span { color: #5992ed; }
    
    .toolbar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .btn { appearance: none; border: 1px solid var(--card-border); background: rgba(255,255,255,0.08); color: var(--text); padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer !important; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; font-family: inherit; user-select: none; }
    .btn:hover { background: rgba(255,255,255,0.18); transform: translateY(-1px); }
    .btn-primary { background: #1351b4 !important; border: 1px solid #2670e8 !important; color: #fff !important; }
    .btn-primary:hover { background: #0c326f !important; }
    .btn-success { background: #168821 !important; border: 1px solid #268744 !important; color: #fff !important; }
    .btn-success:hover { background: #106619 !important; }
    
    /* Layout Container */
    .report-wrapper { max-width: 1080px; margin: 32px auto; padding: 0 20px; }

    /* Executive Hero Cover */
    .executive-cover { background: linear-gradient(135deg, #071d41 0%, #0c326f 50%, #1351b4 100%); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 40px; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); margin-bottom: 28px; }
    .cover-chip { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); padding: 5px 14px; border-radius: 100px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #fff; margin-bottom: 16px; }
    .cover-heading { font-size: 32px; font-weight: 900; line-height: 1.2; margin-bottom: 10px; color: #fff; }
    .cover-subheading { font-size: 15px; color: #dbe8fb; max-width: 760px; line-height: 1.5; }
    
    /* KPI Stats Row */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-top: 28px; }
    .kpi-card { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 18px; text-align: left; }
    .kpi-label { font-size: 11px; font-weight: 700; color: #c5d4eb; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
    .kpi-value { font-size: 26px; font-weight: 900; color: #fff; }
    .kpi-sub { font-size: 11px; color: #dbe8fb; margin-top: 4px; }
    
    /* Progress Bar */
    .progress-track { width: 100%; height: 8px; background: rgba(255,255,255,0.15); border-radius: 100px; margin-top: 8px; overflow: hidden; }
    .progress-fill { height: 100%; background: #268744; border-radius: 100px; transition: width 0.5s ease; }

    /* Executive AI Summary Box */
    .ai-summary-card { background: var(--card-bg); border: 1px solid var(--card-border); border-left: 5px solid #1351b4; border-radius: 10px; padding: 28px; margin-bottom: 28px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .ai-summary-card h2 { font-size: 18px; font-weight: 800; margin-bottom: 16px; color: var(--primary-light); display: flex; align-items: center; gap: 8px; }
    .ai-content { font-size: 14px; color: var(--text-muted); line-height: 1.7; }
    .ai-content strong { color: var(--text); }
    .ai-content ul, .ai-content ol { margin: 10px 0 14px 20px; }
    .ai-content li { margin-bottom: 4px; }
    .ai-content table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
    .ai-content th { background: rgba(19, 81, 180, 0.12); padding: 10px 12px; text-align: left; font-weight: 700; color: var(--text); border-bottom: 2px solid var(--card-border); }
    .ai-content td { padding: 10px 12px; border-bottom: 1px solid var(--card-border); color: var(--text-muted); }

    /* Filter & Search Bar */
    .filter-section { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 28px 0 18px; flex-wrap: wrap; }
    .filter-pills { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill-btn { padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--text-muted); cursor: pointer !important; transition: all 0.2s; user-select: none; }
    .pill-btn.active, .pill-btn:hover { background: #1351b4; color: #fff; border-color: #1351b4; }
    .search-input { background: var(--card-bg); border: 1px solid var(--card-border); color: var(--text); padding: 8px 14px; border-radius: 6px; font-size: 12px; outline: none; width: 240px; font-family: inherit; }

    /* Test Case Detailed Card */
    .test-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; margin-bottom: 24px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); page-break-inside: avoid; }
    .test-header { padding: 18px 24px; background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--card-border); display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .test-title-wrapper { display: flex; align-items: center; gap: 12px; }
    .test-index { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 800; background: rgba(19, 81, 180, 0.15); color: var(--primary-light); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(19, 81, 180, 0.3); }
    .test-title { font-size: 16px; font-weight: 800; color: var(--text); outline: none; }
    .test-badges { display: flex; align-items: center; gap: 8px; }
    .badge { font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
    
    /* Visual Cues for Editable Content */
    [contenteditable="true"] { outline: none; transition: background 0.2s; border-radius: 4px; padding: 2px 4px; }
    [contenteditable="true"]:hover { background: rgba(19, 81, 180, 0.08); cursor: text; }
    [contenteditable="true"]:focus { background: rgba(19, 81, 180, 0.15); box-shadow: 0 0 0 2px #1351b4; }

    .test-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
    .section-block { display: flex; flex-direction: column; gap: 8px; }
    .section-title { font-size: 12px; font-weight: 800; color: var(--primary-light); text-transform: uppercase; letter-spacing: 0.8px; display: flex; align-items: center; gap: 6px; }
    
    .description-box { background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 14px 18px; font-size: 13px; color: var(--text-muted); line-height: 1.6; outline: none; }
    .description-box strong { color: var(--text); }

    /* Evidence Audit Badge */
    .evidence-audit-badge { background: rgba(22, 136, 33, 0.06); border: 1px solid rgba(22, 136, 33, 0.25); border-radius: 8px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; cursor: pointer; }
    .audit-icon { font-size: 24px; }
    .audit-details { flex: 1; min-width: 200px; }
    .audit-title { font-size: 13px; font-weight: 800; color: var(--text); margin-bottom: 2px; }
    .audit-desc { font-size: 12px; color: var(--text-muted); }
    .audit-desc strong { color: var(--text); }
    .audit-date { font-size: 11px; color: var(--primary-light); font-family: 'JetBrains Mono', monospace; margin-top: 4px; }
    .audit-tag { font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 4px; background: rgba(22, 136, 33, 0.15); color: var(--success); border: 1px solid rgba(22, 136, 33, 0.3); letter-spacing: 0.8px; }

    /* Evidence Image Previews (Zoomable) */
    .evidence-preview-wrapper { position: relative; border-radius: 8px; overflow: hidden; border: 1px solid var(--card-border); background: #000; cursor: zoom-in !important; max-width: 100%; max-height: 420px; display: flex; justify-content: center; align-items: center; }
    .evidence-img { max-width: 100%; max-height: 420px; object-fit: contain; display: block; transition: transform 0.2s; cursor: zoom-in !important; }
    .evidence-preview-wrapper:hover .evidence-img { transform: scale(1.015); }
    .img-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); opacity: 0; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; color: #fff; font-weight: 700; font-size: 13px; cursor: zoom-in !important; }
    .evidence-preview-wrapper:hover .img-overlay { opacity: 1; }

    /* Step-by-Step Grid */
    .steps-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 6px; }
    .step-item { background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
    .step-item.step-ok { border-left: 4px solid var(--success); }
    .step-item.step-fail { border-left: 4px solid var(--danger); }
    .step-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
    .step-badge { width: 22px; height: 22px; border-radius: 4px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; }
    .step-label { font-weight: 700; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .step-status { font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 4px; }
    .status-ok { color: var(--success); background: rgba(22, 136, 33, 0.15); }
    .status-fail { color: var(--danger); background: rgba(229, 34, 7, 0.15); }
    .step-detail { font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }
    .step-img-box { position: relative; border-radius: 6px; overflow: hidden; border: 1px solid var(--card-border); height: 140px; cursor: zoom-in !important; }
    .step-img-box img { width: 100%; height: 100%; object-fit: cover; cursor: zoom-in !important; }
    .zoom-tag { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.75); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; cursor: zoom-in !important; }

    /* Image Edit Bars and Actions */
    .img-edit-btn { background: rgba(19, 81, 180, 0.15); border: 1px solid rgba(19, 81, 180, 0.3); color: var(--primary-light); font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
    .img-edit-btn:hover { background: #1351b4; color: #fff; }
    .img-action-bar { position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; z-index: 10; opacity: 0; transition: opacity 0.2s; }
    .evidence-preview-wrapper:hover .img-action-bar { opacity: 1; }
    .img-action-pill { background: rgba(0,0,0,0.85); border: 1px solid rgba(255,255,255,0.25); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; }
    .img-action-pill:hover { background: #1351b4; }
    .img-action-pill.danger:hover { background: #e52207; }
    
    .step-img-container { margin-top: 6px; }
    .step-img-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; z-index: 10; opacity: 0; transition: opacity 0.2s; }
    .step-img-box:hover .step-img-actions { opacity: 1; }
    .step-img-actions button { background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.3); color: #fff; width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 10px; }
    .step-img-actions button:hover { background: #1351b4; }
    .step-img-actions button.danger:hover { background: #e52207; }
    
    .step-img-empty { border: 1px dashed var(--card-border); border-radius: 6px; padding: 10px; text-align: center; color: var(--text-muted); font-size: 11px; cursor: pointer; background: rgba(255,255,255,0.01); transition: all 0.2s; }
    .step-img-empty:hover { border-color: #1351b4; color: var(--primary-light); background: rgba(19, 81, 180, 0.05); }

    /* Code Box */
    .code-box { background: var(--code-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 16px; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #93c5fd; line-height: 1.6; }

    /* Lightbox Modal (Full Resolution Zoom) */
    .lightbox-modal { position: fixed; inset: 0; z-index: 9999999; background: rgba(0,0,0,0.92); backdrop-filter: blur(8px); display: none; align-items: center; justify-content: center; padding: 30px; flex-direction: column; }
    .lightbox-modal.active { display: flex !important; }
    .lightbox-img { max-width: 95vw; max-height: 85vh; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 50px rgba(0,0,0,0.9); border: 1px solid rgba(255,255,255,0.15); }
    .lightbox-caption { color: #f8fafc; font-size: 14px; font-weight: 700; margin-top: 14px; text-align: center; max-width: 800px; }
    .lightbox-close { position: absolute; top: 20px; right: 24px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: #fff; font-size: 22px; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
    .lightbox-close:hover { background: #e52207; border-color: #e52207; }

    /* Print / PDF Formatting */
    @media print {
      body { background: #fff !important; color: #111827 !important; font-size: 12px !important; }
      .top-toolbar, .filter-section, .lightbox-modal { display: none !important; }
      .report-wrapper { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
      
      .executive-cover { background: #071d41 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-after: always; margin-bottom: 24px; border-radius: 0; padding: 30px; }
      .cover-heading { color: #fff !important; font-size: 26px !important; }
      .cover-subheading { color: #dbe8fb !important; }
      .kpi-card { background: rgba(255,255,255,0.1) !important; border: 1px solid #2670e8 !important; }
      .kpi-value { color: #fff !important; }
      
      .ai-summary-card { background: #f9fafb !important; border: 1px solid #d1d5db !important; border-left: 5px solid #1351b4 !important; color: #1f2937 !important; page-break-inside: avoid; margin-bottom: 20px; }
      .ai-content { color: #374151 !important; }
      .ai-content th { background: #e5e7eb !important; color: #111827 !important; border-color: #d1d5db !important; }
      .ai-content td { border-color: #e5e7eb !important; color: #374151 !important; }
      
      .test-card { box-shadow: none !important; border: 1px solid #d1d5db !important; margin-bottom: 20px !important; background: #ffffff !important; page-break-inside: avoid; border-radius: 8px; }
      .test-header { background: #f9fafb !important; border-bottom: 1px solid #d1d5db !important; padding: 14px 18px !important; }
      .test-title { color: #111827 !important; font-size: 15px !important; }
      .section-title { color: #1351b4 !important; font-size: 11px !important; }
      .description-box { background: #f9fafb !important; color: #374151 !important; border: 1px solid #d1d5db !important; padding: 12px !important; }
      .code-box { background: #f3f4f6 !important; color: #1f2937 !important; border: 1px solid #d1d5db !important; page-break-inside: avoid; }
      
      .step-item { background: #f9fafb !important; border: 1px solid #d1d5db !important; page-break-inside: avoid; }
      .step-label { color: #111827 !important; }
      .step-detail { color: #4b5563 !important; }
      
      .evidence-preview-wrapper { background: #f9fafb !important; border: 1px solid #d1d5db !important; max-height: 320px !important; page-break-inside: avoid; }
      .evidence-img { max-height: 320px !important; }
      .img-overlay { display: none !important; }
      .evidence-audit-badge { background: #f9fafb !important; border: 1px solid #d1d5db !important; color: #111827 !important; }
      .audit-title { color: #111827 !important; }
      .audit-desc { color: #4b5563 !important; }
    }
  </style>
</head>
<body>

  <!-- Top Controls Bar -->
  <div class="top-toolbar">
    <div class="toolbar-left">
      <div class="brand-tag">⚡ <span>Planner QA Studio</span> &bull; Relatório Executivo</div>
    </div>
    <div class="toolbar-actions">
      <button class="btn" id="themeBtn" title="Alternar entre tema claro e escuro">🌓 Tema Claro/Escuro</button>
      <button class="btn" id="editBtn" title="Permite editar os textos e títulos diretamente na página">✏️ Modo Edição</button>
      <button class="btn btn-success" id="downloadHtmlBtn" title="Baixa este relatório em HTML com todas as fotos e alterações salvas">💾 Baixar HTML com Edições</button>
      <button class="btn btn-primary" id="printBtn" title="Imprime ou salva em formato PDF executivo">🖨️ Exportar PDF / Imprimir</button>
    </div>
  </div>

  <div class="report-wrapper">
    <!-- Executive Cover Section -->
    <div class="executive-cover">
      <div class="cover-chip">📋 Relatório Executivo Consolidado de QA</div>
      <h1 class="cover-heading" contenteditable="true">Relatório de Testes & Evidências de Qualidade</h1>
      <p class="cover-subheading" contenteditable="true">Consolidação oficial com evidências fotográficas, roteiros de automação, planos de teste estruturados e diagnóstico de qualidade.</p>
      
      <!-- Metrics KPI Grid -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total de Testes</div>
          <div class="kpi-value">${totalCount}</div>
          <div class="kpi-sub">Casos Selecionados</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Taxa de Sucesso</div>
          <div class="kpi-value" style="color:var(--success);">${successRate}%</div>
          <div class="progress-track"><div class="progress-fill" style="width:${successRate}%;"></div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Concluídos / OK</div>
          <div class="kpi-value" style="color:var(--success);">${doneCount}</div>
          <div class="kpi-sub">Aprovados com Sucesso</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Em Andamento</div>
          <div class="kpi-value" style="color:var(--warning);">${inProgressCount}</div>
          <div class="kpi-sub">Em Execução</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Data de Emissão</div>
          <div class="kpi-value" style="font-size:16px;padding-top:6px;">${now.split(' ')[0]}</div>
          <div class="kpi-sub">${now.split(' ')[1] || ''}</div>
        </div>
      </div>
    </div>

    <!-- AI Quality Diagnosis Summary -->
    <div class="ai-summary-card">
      <h2>✨ Diagnóstico Consolidado de Qualidade</h2>
      <div class="ai-content" id="aiContent" contenteditable="true">
        ${content
          .replace(/^### (.+)$/gm, '<h3 style="color:var(--primary-light);font-size:15px;margin:16px 0 6px;">$1</h3>')
          .replace(/^## (.+)$/gm, '<h2 style="color:var(--text);font-size:17px;margin:22px 0 10px;border-bottom:1px solid var(--card-border);padding-bottom:4px;">$1</h2>')
          .replace(/^# (.+)$/gm, '<h1 style="color:var(--text);font-size:19px;margin:24px 0 12px;">$1</h1>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`(.+?)`/g, '<code>$1</code>')
          .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--card-border);margin:24px 0;" />')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
          .replace(/(<li>.*<\/li>\n?)+/g, s => '<ul style="margin:8px 0 14px 20px;">' + s + '</ul>')
          .replace(/\n\n/g, '</p><p style="margin-bottom:10px;">')
        }
      </div>
    </div>

    <!-- Interactive Filters -->
    <div class="filter-section">
      <div class="filter-pills">
        <button class="pill-btn active" data-filter="all">Todos (${totalCount})</button>
        <button class="pill-btn" data-filter="done">Concluídos (${doneCount})</button>
        <button class="pill-btn" data-filter="in_progress">Em Progresso (${inProgressCount})</button>
        <button class="pill-btn" data-filter="todo">A Fazer (${todoCount})</button>
      </div>
      <input type="text" class="search-input" id="searchInput" placeholder="🔍 Filtrar testes pelo título..." />
    </div>

    <!-- Detailed Test Cards List -->
    <div id="testsContainer">
      ${tasksCardsHtml}
    </div>

    <div style="text-align:center;color:var(--text-muted);font-size:12px;margin-top:50px;padding-top:20px;border-top:1px solid var(--card-border);">
      Relatório emitido pelo <strong>Planner QA Studio</strong> &bull; Documento Oficial de Qualidade &bull; ${now}
    </div>
  </div>

  <!-- Lightbox Modal (Zoom Fullscreen) -->
  <div class="lightbox-modal" id="lightboxModal">
    <button class="lightbox-close" id="lightboxCloseBtn" title="Fechar">&times;</button>
    <img src="" alt="Zoom Evidência" class="lightbox-img" id="lightboxImg" />
    <div class="lightbox-caption" id="lightboxCaption"></div>
  </div>

  <script>
    (function() {
      // 1. Alternador de Tema
      function toggleTheme() {
        var html = document.documentElement;
        var current = html.getAttribute('data-theme') || 'dark';
        var next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        var btn = document.getElementById('themeBtn');
        if (btn) {
          btn.innerText = next === 'dark' ? '🌓 Tema Claro' : '🌓 Tema Escuro';
        }
      }

      // 2. Modo Edição
      var isEditing = true;
      function toggleEdit() {
        isEditing = !isEditing;
        var elements = document.querySelectorAll('[contenteditable]');
        for (var i = 0; i < elements.length; i++) {
          elements[i].contentEditable = isEditing ? 'true' : 'false';
        }
        var btn = document.getElementById('editBtn');
        if (btn) {
          btn.innerText = isEditing ? '✏️ Modo Edição (Ativo)' : '🔒 Modo Leitura';
          btn.style.background = isEditing ? 'rgba(19, 81, 180, 0.25)' : 'rgba(255,255,255,0.08)';
        }
      }

      // 3. Filtro por Status
      function filterStatus(status, clickedBtn) {
        var pills = document.querySelectorAll('.pill-btn');
        for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
        if (clickedBtn) clickedBtn.classList.add('active');

        var cards = document.querySelectorAll('.test-card');
        for (var j = 0; j < cards.length; j++) {
          var card = cards[j];
          if (status === 'all' || card.getAttribute('data-status') === status) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        }
      }

      // 4. Busca por Texto
      function searchTests(query) {
        var q = (query || '').toLowerCase();
        var cards = document.querySelectorAll('.test-card');
        for (var i = 0; i < cards.length; i++) {
          var card = cards[i];
          var text = card.innerText.toLowerCase();
          card.style.display = text.indexOf(q) !== -1 ? 'block' : 'none';
        }
      }

      // 5. Download HTML com Edições
      function downloadEditedHtml() {
        var fullHtml = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
        var blob = new Blob([fullHtml], { type: 'text/html; charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio-qa-evidencias-' + new Date().toISOString().slice(0, 10) + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 4000);
      }

      // 6. Imprimir / Salvar PDF
      function printReport() {
        window.print();
      }

      // 7. Lightbox Zoom
      function openLightbox(src, caption) {
        var modal = document.getElementById('lightboxModal');
        var img = document.getElementById('lightboxImg');
        var cap = document.getElementById('lightboxCaption');
        if (modal && img) {
          img.src = src;
          if (cap) cap.innerText = caption || '';
          modal.classList.add('active');
        }
      }

      function closeLightbox() {
        var modal = document.getElementById('lightboxModal');
        if (modal) modal.classList.remove('active');
      }

      // 8. Upload de Imagem Dinâmico
      function triggerImageUpload(sectionEl) {
        if (!sectionEl) return;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function() {
            setSectionImage(sectionEl, reader.result);
          };
          reader.readAsDataURL(file);
        };
        input.click();
      }

      function setSectionImage(sectionEl, dataUrl) {
        if (!sectionEl) return;
        var existingWrapper = sectionEl.querySelector('.evidence-preview-wrapper');
        var existingBadge = sectionEl.querySelector('.evidence-audit-badge');
        if (existingWrapper) {
          var img = existingWrapper.querySelector('img');
          if (img) img.src = dataUrl;
        } else {
          var titleEl = sectionEl.closest('.test-card') ? sectionEl.closest('.test-card').querySelector('.test-title') : null;
          var cardTitle = titleEl ? titleEl.innerText : 'Evidência';
          var newWrapper = document.createElement('div');
          newWrapper.className = 'evidence-preview-wrapper';
          newWrapper.innerHTML = 
            '<img src="' + dataUrl + '" alt="Evidência" class="evidence-img" />' +
            '<div class="img-overlay"><span>🔍 Clique para zoom</span></div>' +
            '<div class="img-action-bar" onclick="event.stopPropagation()">' +
              '<button class="img-action-pill add-btn" title="Trocar imagem">📷 Trocar</button>' +
              '<button class="img-action-pill danger rm-btn" title="Remover imagem">🗑️ Remover</button>' +
            '</div>';
          if (existingBadge) {
            existingBadge.replaceWith(newWrapper);
          } else {
            sectionEl.appendChild(newWrapper);
          }
        }
      }

      // 9. Listener Global de Cliques (Delegação Total Infalível)
      document.addEventListener('click', function(e) {
        var target = e.target;

        // Botão Tema
        if (target.closest('#themeBtn')) {
          e.preventDefault();
          toggleTheme();
          return;
        }

        // Botão Modo Edição
        if (target.closest('#editBtn')) {
          e.preventDefault();
          toggleEdit();
          return;
        }

        // Botão Download HTML
        if (target.closest('#downloadHtmlBtn')) {
          e.preventDefault();
          downloadEditedHtml();
          return;
        }

        // Botão Imprimir / PDF
        if (target.closest('#printBtn')) {
          e.preventDefault();
          printReport();
          return;
        }

        // Filtro de Status
        var pill = target.closest('.pill-btn');
        if (pill) {
          e.preventDefault();
          var filter = pill.getAttribute('data-filter') || 'all';
          filterStatus(filter, pill);
          return;
        }

        // Trocar imagem
        if (target.closest('.add-btn') || target.closest('.step-img-empty')) {
          e.preventDefault();
          e.stopPropagation();
          var section = target.closest('.evidence-section') || target.closest('.step-item');
          triggerImageUpload(section);
          return;
        }

        // Remover imagem
        if (target.closest('.rm-btn')) {
          e.preventDefault();
          e.stopPropagation();
          var wrapper = target.closest('.evidence-preview-wrapper') || target.closest('.step-img-box');
          if (wrapper) wrapper.remove();
          return;
        }

        // Fechar Lightbox
        if (target.closest('#lightboxCloseBtn') || target.id === 'lightboxModal') {
          e.preventDefault();
          closeLightbox();
          return;
        }

        // Zoom na Imagem (Qualquer clique em foto de teste, container ou overlay)
        var zoomBox = target.closest('.evidence-preview-wrapper, .step-img-box, .evidence-img');
        if (zoomBox && !target.closest('.img-action-bar, .step-img-actions')) {
          e.preventDefault();
          e.stopPropagation();
          var imgEl = zoomBox.tagName === 'IMG' ? zoomBox : zoomBox.querySelector('img');
          if (imgEl && imgEl.src) {
            var cardEl = zoomBox.closest('.test-card');
            var captionTitle = cardEl ? (cardEl.querySelector('.test-title') ? cardEl.querySelector('.test-title').innerText : 'Evidência') : 'Evidência de Teste';
            openLightbox(imgEl.src, captionTitle);
          }
          return;
        }
      });

      // Busca ao digitar
      var searchEl = document.getElementById('searchInput');
      if (searchEl) {
        searchEl.addEventListener('input', function() {
          searchTests(this.value);
        });
      }

      // Fechar com ESC
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeLightbox();
      });

      // Exporta funções globalmente
      window.toggleTheme = toggleTheme;
      window.toggleEdit = toggleEdit;
      window.downloadEditedHtml = downloadEditedHtml;
      window.printReport = printReport;
      window.openLightbox = openLightbox;
      window.closeLightbox = closeLightbox;
    })();
  </script>
</body>
</html>`;

      // Cria Blob e abre a visualização
      const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const newWin = window.open(blobUrl, '_blank');
      
      if (!newWin) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      alert('Erro ao gerar relatório HTML: ' + (err.message || err));
    } finally {
      setGeneratingTasksPdf(false);
    }
  };

  const executeBulkAutomation = async () => {
    const ids = Array.from(selectedTasks);
    if (ids.length === 0) return;
    
    const tasksToRun = ids.map(id => tasks.find(t => t.id === id)).filter(t => t && t.metadata?.automationCode);
    if (tasksToRun.length === 0) {
      alert("Nenhuma das tarefas selecionadas possui código de automação gerado. Gere a automação clicando em 'ABRIR' primeiro.");
      return;
    }

    const targetUrl = prompt("Qual a URL alvo para executar as automações?", projectUrl || "http://localhost:3000");
    if (!targetUrl) return;

    setIsBatchRunning(true);
    let current = 0;
    const total = tasksToRun.length;

    const supabase = createClient();
    let updatedTasks = [...tasks];

    for (const task of tasksToRun) {
      if (!task) continue;
      current++;
      setBatchProgress({ current, total, title: task.title, action: "Executando" });
      
      const rawCode = (task.metadata?.automationCode as string) || "";
      const codeMatch = rawCode.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)\s*```/);
      const code = codeMatch ? codeMatch[1] : rawCode;
      
      // Usa a descrição da tarefa se disponível para passos completos
      const flowDescription = task.description ? `${task.title}\n\n${task.description}` : code;

      try {
        if (task.status !== "in_progress") {
          updatedTasks = updatedTasks.map(t => t.id === task.id ? { ...t, status: "in_progress" } : t);
          onTasksChange(updatedTasks);
          await supabase.from("tasks").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", task.id);
        }

        const res = await fetch("/api/automation/smart-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl,
            flowDescription,
            jobName: task.title,
            project_id: projectId,
            model: "auto-free",
            includeAxe: false
          })
        });

        let finalResult: any = null;
        let lastErrorMsg = "";
        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line.startsWith("data: ") ? line.slice(6) : line);
                if (parsed.type === "result" || parsed.type === "end") {
                  finalResult = parsed.data || parsed.result;
                } else if (parsed.type === "error") {
                  lastErrorMsg = parsed.error || "";
                }
              } catch (e) {}
            }
          }
        }
        
        const passed = finalResult?.success === true;
        const nextStatus = passed ? "done" : "in_progress";
        
        // Extrai a screenshot final ou o screenshot do primeiro passo executado
        const autoEvidence = finalResult?.finalScreenshot || finalResult?.steps?.find((s: any) => s.screenshotBase64)?.screenshotBase64;
        
        const newMetadata = { 
          ...(task.metadata || {}), 
          lastRunResult: finalResult,
          ...(autoEvidence ? { evidence: autoEvidence } : {})
        };
        if (passed) delete (newMetadata as any).automationCode;
        
        updatedTasks = updatedTasks.map(t => t.id === task.id ? { ...t, status: nextStatus, metadata: newMetadata } : t);
        onTasksChange(updatedTasks);
        await supabase.from("tasks").update({ status: nextStatus, metadata: newMetadata, updated_at: new Date().toISOString() }).eq("id", task.id);

        // Se o teste falhou, abre o modal de intervenção manual para o usuário validar
        if (!passed) {
          const failedStep = finalResult?.steps?.find((s: any) => s.status !== "aprovado");
          const errorDetail = failedStep?.detalhe || lastErrorMsg || "Automação não concluiu todos os passos com sucesso.";
          
          setManualTaskModal({
            task,
            errorMsg: errorDetail,
            targetUrl
          });
          setManualEvidence(null);
        }
      } catch (e: any) {
        setManualTaskModal({
          task,
          errorMsg: e.message || "Erro de conexão ao executar automação.",
          targetUrl
        });
      }
    }
    
    setIsBatchRunning(false);
    setBatchProgress({ current: 0, total: 0, title: "", action: "Executando" });
    setSelectedTasks(new Set());
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSet = new Set(selectedTasks);
    if (newSet.has(taskId)) newSet.delete(taskId);
    else newSet.add(taskId);
    setSelectedTasks(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const deleteSelectedTasks = async () => {
    if (!confirm(`Tem certeza que deseja apagar ${selectedTasks.size} tarefas?`)) return;
    const supabase = createClient();
    const ids = Array.from(selectedTasks);
    await supabase.from("tasks").delete().in("id", ids);
    onTasksChange(tasks.filter(t => !selectedTasks.has(t.id) && (!t.parent_task_id || !selectedTasks.has(t.parent_task_id))));
    setSelectedTasks(new Set());
  };

  const applyBulkEdit = async () => {
    const supabase = createClient();
    const updates: Partial<Task> = { updated_at: new Date().toISOString() };
    if (bulkStatus) updates.status = bulkStatus as TaskStatus;
    if (bulkPriority) updates.priority = bulkPriority as TaskPriority;
    
    if (Object.keys(updates).length > 1) {
      const ids = Array.from(selectedTasks);
      
      const newTasks = tasks.map(t => {
        if (selectedTasks.has(t.id)) {
          let updatedTask = { ...t, ...updates };
          if (bulkStatus === "done" && updatedTask.metadata?.automationCode) {
            const metadata = { ...updatedTask.metadata };
            delete (metadata as any).automationCode;
            updatedTask.metadata = metadata;
          }
          return updatedTask;
        }
        return t;
      });

      // Atualização otimista da UI (Instantânea)
      onTasksChange(newTasks);
      setShowBulkEdit(false);
      setSelectedTasks(new Set());
      setBulkStatus("");
      setBulkPriority("");

      // Se for "done", precisamos atualizar a metadata das tasks no banco (em paralelo)
      if (bulkStatus === "done") {
        await Promise.all(
          newTasks.filter(nt => ids.includes(nt.id)).map(t => 
            supabase.from("tasks").update({ 
              status: "done", 
              metadata: t.metadata, 
              updated_at: updates.updated_at 
            }).eq("id", t.id)
          )
        );
      } else {
        await supabase.from("tasks").update(updates).in("id", ids);
      }
    } else {
      setShowBulkEdit(false);
    }
  };



  const addSubtask = async (parentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        parent_task_id: parentId,
        title: newSubtaskTitle.trim(),
        status: "todo",
        priority: "medium",
      })
      .select()
      .single();

    if (data) {
      onTasksChange([...tasks, data as Task]);
      setNewSubtaskTitle("");
      setSubtaskFormId(null);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setAdding(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          project_id: projectId,
          title: newTitle.trim(),
          status: "todo",
          priority: "medium",
        })
        .select()
        .single();

      if (error) {
        console.error("Erro ao criar tarefa no Supabase:", error);
        alert("Erro ao criar tarefa: " + error.message);
      } else if (data) {
        onTasksChange([data as Task, ...tasks]);
        setNewTitle("");
        setShowForm(false);
      }
    } catch (err: any) {
      console.error("Erro inesperado ao criar tarefa:", err);
      alert("Erro ao criar tarefa: " + (err.message || "Erro de conexão"));
    } finally {
      setAdding(false);
    }
  };

  const cycleStatus = async (task: Task) => {
    const nextStatus = STATUS_CYCLE[task.status];
    const supabase = createClient();

    let metadata = task.metadata;
    if (nextStatus === "done" && metadata?.automationCode) {
      metadata = { ...metadata };
      delete metadata.automationCode;
    }

    await supabase
      .from("tasks")
      .update({ status: nextStatus, updated_at: new Date().toISOString(), metadata })
      .eq("id", task.id);

    onTasksChange(
      tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus, metadata } : t))
    );
  };

  const updatePriority = async (taskId: string, priority: TaskPriority) => {
    const supabase = createClient();
    await supabase.from("tasks").update({ priority }).eq("id", taskId);
    onTasksChange(
      tasks.map((t) => (t.id === taskId ? { ...t, priority } : t))
    );
  };

  const updateDescription = async (taskId: string, description: string) => {
    const supabase = createClient();
    await supabase.from("tasks").update({ description }).eq("id", taskId);
    onTasksChange(
      tasks.map((t) => (t.id === taskId ? { ...t, description } : t))
    );
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Tem certeza que deseja apagar esta tarefa?")) return;
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", taskId);
    onTasksChange(tasks.filter((t) => t.id !== taskId && t.parent_task_id !== taskId));
  };

  const cancelTask = async (taskId: string) => {
    const supabase = createClient();
    await supabase.from("tasks").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", taskId);
    onTasksChange(tasks.map((t) => (t.id === taskId ? { ...t, status: "cancelled" } : t)));
  };

  const statusFilters: (TaskStatus | "all")[] = [
    "all",
    "todo",
    "in_progress",
    "done",
    "cancelled",
  ];
  const statusLabel: Record<string, string> = {
    all: "Todas",
    todo: "A fazer",
    in_progress: "Em progresso",
    done: "Concluídas",
    cancelled: "Canceladas",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <TaskDetailPane
        taskId={activeTaskId}
        onClose={() => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("taskId");
          router.replace(`${pathname}?${params.toString()}`);
        }}
        tasks={tasks}
        onTasksChange={onTasksChange}
        projectUrl={projectUrl}
      />
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={toggleSelectAll}
            className="w-6 h-6 rounded flex items-center justify-center mr-2 border border-border bg-background hover:bg-accent transition-colors"
            title={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0 ? "Desmarcar todas" : "Selecionar todas"}
          >
            {selectedTasks.size === filteredTasks.length && filteredTasks.length > 0 ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                filterStatus === s
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {statusLabel[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => generateBulkTestPlans(tasks)}
            disabled={isGeneratingPlans || isBatchRunning || tasks.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/20 transition-all disabled:opacity-50"
            title="Gerar especificações e planos de teste com IA para todos os casos de teste"
          >
            {isGeneratingPlans ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
            Gerar Plano para Todos
          </button>
          <button
            id="add-task-btn"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova tarefa
          </button>
        </div>
      </div>

      {isGeneratingPlans && (
        <div className="bg-indigo-500/10 border-b border-indigo-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-indigo-400 font-medium animate-pulse">
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            {planProgress || "Gerando planos de teste estruturados com IA..."}
          </span>
          <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded font-mono">IA EM EXECUÇÃO</span>
        </div>
      )}

      <AnimatePresence>
        {selectedTasks.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-accent/50 border-b border-border px-6 py-3 flex items-center justify-between gap-4 overflow-hidden"
          >
            <span className="text-xs font-semibold text-foreground">
              {selectedTasks.size} selecionadas
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateBulkTestPlans()}
                disabled={isGeneratingPlans || isBatchRunning}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 transition-all disabled:opacity-50 flex items-center gap-1.5"
                title="Gerar especificações e planos de teste estruturados com IA"
              >
                {isGeneratingPlans ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Gerar Planos
              </button>
              <button
                onClick={generateBulkAutomation}
                disabled={isBatchRunning || isGeneratingPlans}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/20 text-sky-500 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Code2 className="w-3.5 h-3.5" />
                Gerar Scripts
              </button>
              <button
                onClick={executeBulkAutomation}
                disabled={isBatchRunning || isGeneratingPlans}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-500 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBatchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Executar
              </button>
              <button
                onClick={() => setShowBulkEdit(!showBulkEdit)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border hover:bg-accent text-foreground transition-all"
              >
                Editar
              </button>
              <button
                onClick={deleteSelectedTasks}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
              >
                Apagar
              </button>
              <button
                onClick={downloadTasksPdf}
                disabled={isBatchRunning || generatingTasksPdf}
                title={`Gerar Relatório Executivo Completo com todas as evidências visuais, steps e diagnóstico IA para ${selectedTasks.size} teste(s)`}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {generatingTasksPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingTasksPdf ? 'Gerando Relatório...' : 'Relatório Completo (HTML)'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showBulkEdit && selectedTasks.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card border-b border-border px-6 py-4 flex flex-col gap-3 overflow-hidden"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Mudar Status para:</span>
                <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as TaskStatus)} className="bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground">
                  <option value="">Manter atual</option>
                  <option value="todo">A fazer</option>
                  <option value="in_progress">Em progresso</option>
                  <option value="done">Concluída</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Mudar Prioridade para:</span>
                <select value={bulkPriority} onChange={e => setBulkPriority(e.target.value as TaskPriority)} className="bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground">
                  <option value="">Manter atual</option>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <button
                onClick={applyBulkEdit}
                disabled={!bulkStatus && !bulkPriority}
                className="mt-auto px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
              >
                Aplicar Alterações
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBatchRunning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-primary/5 border-b border-primary/20 px-6 py-3 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {batchProgress.action}: {batchProgress.title}
              </span>
              <span className="text-xs font-bold text-primary">{batchProgress.current} / {batchProgress.total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={addTask}
              className="flex items-center gap-2 bg-surface border border-border/50 rounded-xl px-4 py-3"
            >
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Título da tarefa..."
                autoFocus
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                aria-label="Título da nova tarefa"
              />
              <button
                type="submit"
                disabled={adding || !newTitle.trim()}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : "Criar"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                ✕
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sortedParentTasks.map((task, i) => {
            const StatusIcon = STATUS_ICON[task.status];
            const taskSubtasks = tasks
              .filter(t => t.parent_task_id === task.id && (filterStatus === "all" || t.status === filterStatus))
              .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
            
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ delay: i * 0.03 }}
                className="mb-2"
              >
                <div
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 border border-transparent border-b-border hover:bg-accent/30 group flex-col sm:flex-row relative transition-colors",
                    task.status === "done" && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3 w-full z-10">
                    <button
                      onClick={() => toggleTaskSelection(task.id)}
                      className="mt-0.5 shrink-0 flex items-center justify-center transition-colors text-muted-foreground hover:text-primary"
                    >
                      {selectedTasks.has(task.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Circle className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => cycleStatus(task)}
                      aria-label={`Status: ${getStatusLabel(task.status)}. Clique para avançar.`}
                      className={cn(
                        "mt-0.5 shrink-0 transition-colors",
                        task.status === "done" ? "text-emerald-400" : "text-muted-foreground hover:text-primary"
                      )}
                    >
                      <StatusIcon className="w-4 h-4" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm text-foreground leading-relaxed",
                          task.status === "done" && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </p>
                      {Boolean(task.metadata?.automationCode) && (
                        <span
                          className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 w-fit"
                          title="Passos de automação já gerados"
                        >
                          <Code2 className="w-2.5 h-2.5" />
                          Passos gerados
                        </span>
                      )}

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <select
                          value={task.priority}
                          onChange={(e) =>
                            updatePriority(task.id, e.target.value as TaskPriority)
                          }
                          aria-label={`Prioridade de ${task.title}`}
                          className={cn(
                            "bg-transparent text-[11px] font-medium border-none outline-none cursor-pointer uppercase tracking-wider",
                            getPriorityColor(task.priority)
                          )}
                        >
                          {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
                            <option key={p} value={p} className="bg-card text-foreground">
                              {getPriorityLabel(p)}
                            </option>
                          ))}
                        </select>
                        {task.due_date && (
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                            {formatDate(task.due_date)}
                          </span>
                        )}
                        
                        <div className="flex items-center gap-2 ml-auto sm:ml-0">
                          <button
                            onClick={() => router.push(`${pathname}?taskId=${task.id}`)}
                            className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            title="Abrir Detalhes"
                          >
                            <Maximize2 className="w-3 h-3" /> ABRIR
                          </button>
                          <button
                            onClick={() => setSubtaskFormId(subtaskFormId === task.id ? null : task.id)}
                            className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            title="Adicionar Subtarefa"
                          >
                            ➕ SUB
                          </button>
                          <button
                            onClick={() => cancelTask(task.id)}
                            className="text-[10px] uppercase font-bold text-amber-500/70 hover:text-amber-500 transition-colors flex items-center gap-1 ml-1"
                            title="Cancelar Tarefa"
                          >
                            CANCELAR
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-[10px] uppercase font-bold text-rose-500/70 hover:text-rose-500 transition-colors flex items-center gap-1"
                            title="Apagar Tarefa"
                          >
                            APAGAR
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {subtaskFormId === task.id && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={(e) => addSubtask(task.id, e)}
                      className="ml-8 mt-2 flex items-center gap-2 bg-surface border border-border/50 rounded-xl px-4 py-2 relative overflow-hidden"
                    >
                      <div className="absolute left-[-24px] top-1/2 w-8 h-px bg-border/50" />
                      <input
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="Título da subtarefa..."
                        autoFocus
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!newSubtaskTitle.trim()}
                        className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs font-medium disabled:opacity-50 hover:bg-primary/30 transition-colors"
                      >
                        Salvar
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {taskSubtasks.length > 0 && (
                  <div className="ml-8 mt-2 space-y-2 relative">
                    <div className="absolute left-[-20px] top-0 bottom-4 w-px bg-border/50" />
                    {taskSubtasks.map(subtask => {
                      const SubIcon = STATUS_ICON[subtask.status];
                      return (
                        <div key={subtask.id} className="relative">
                          <div className="absolute left-[-20px] top-4 w-4 h-px bg-border/50" />
                          <div className={cn(
                            "flex items-center gap-3 px-4 py-2 border-b border-border/30 hover:bg-accent/20 group flex-col sm:flex-row transition-colors",
                            subtask.status === "done" && "opacity-60"
                          )}>
                            <button
                              onClick={() => cycleStatus(subtask)}
                              className={cn(
                                "mt-0.5 shrink-0 transition-colors",
                                subtask.status === "done" ? "text-emerald-400" : "text-muted-foreground hover:text-primary"
                              )}
                            >
                              <SubIcon className="w-4 h-4" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm text-foreground leading-relaxed",
                                subtask.status === "done" && "line-through text-muted-foreground"
                              )}>
                                {subtask.title}
                              </p>
                              {Boolean(subtask.metadata?.automationCode) && (
                                <span
                                  className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 w-fit"
                                  title="Passos de automação já gerados"
                                >
                                  <Code2 className="w-2.5 h-2.5" />
                                  Passos gerados
                                </span>
                              )}
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <select
                                  value={subtask.priority}
                                  onChange={(e) => updatePriority(subtask.id, e.target.value as TaskPriority)}
                                  className={cn("bg-transparent text-[11px] font-medium border-none outline-none cursor-pointer uppercase tracking-wider", getPriorityColor(subtask.priority))}
                                >
                                  {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
                                    <option key={p} value={p} className="bg-card text-foreground">{getPriorityLabel(p)}</option>
                                  ))}
                                </select>
                                
                                <div className="flex items-center gap-2 ml-auto">
                                  <button
                                    onClick={() => router.push(`${pathname}?taskId=${subtask.id}`)}
                                    className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                    title="Abrir Detalhes"
                                  >
                                    <Maximize2 className="w-3 h-3" /> ABRIR
                                  </button>
                                  <button
                                    onClick={() => deleteTask(subtask.id)}
                                    className="text-[10px] uppercase font-bold text-rose-500/70 hover:text-rose-500 transition-colors"
                                    title="Apagar Subtarefa"
                                  >
                                    APAGAR
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
              <CheckSquare className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {filterStatus === "all"
                ? "Nenhuma tarefa criada neste projeto"
                : `Nenhuma tarefa ${statusLabel[filterStatus].toLowerCase()}`}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-6">
              {filterStatus === "all"
                ? "Você pode criar tarefas manualmente, sugerir com IA ou importar casos de teste da aba 'Casos de Teste'."
                : "Altere o filtro acima para 'Todas' para ver as demais tarefas."}
            </p>
            {filterStatus === "all" && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Criar primeira tarefa
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Notificação de Falha e Execução Manual */}
      <AnimatePresence>
        {manualTaskModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                  const file = items[i].getAsFile();
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => setManualEvidence(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header com Alerta */}
              <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 font-bold text-lg animate-pulse">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Automação Não Concluída &bull; Validação Manual</h3>
                    <p className="text-xs text-rose-400 font-medium">{manualTaskModal.task.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setManualTaskModal(null)}
                  className="text-muted-foreground hover:text-foreground text-sm p-1"
                >
                  ✕
                </button>
              </div>

              {/* Corpo */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {/* Detalhe do Erro */}
                <div className="bg-rose-950/30 border border-rose-500/20 rounded-xl p-3.5 text-rose-300 font-mono text-[11px]">
                  <strong>Motivo da Falha:</strong> {manualTaskModal.errorMsg}
                </div>

                {/* Passo a Passo para Execução Manual */}
                <div>
                  <h4 className="font-bold text-foreground mb-2 uppercase tracking-wider text-[11px] text-sky-400">
                    📋 Roteiro de Passos do Teste
                  </h4>
                  <div className="bg-accent/30 border border-border rounded-xl p-4 text-foreground/90 whitespace-pre-wrap font-sans text-xs leading-relaxed max-h-48 overflow-y-auto">
                    {manualTaskModal.task.description || "Nenhum passo cadastrado na descrição."}
                  </div>
                </div>

                {/* Botão de Abertura da URL */}
                <div className="flex items-center justify-between bg-sky-500/10 border border-sky-500/20 rounded-xl p-3.5">
                  <div>
                    <p className="font-bold text-sky-400">Deseja executar manualmente no navegador?</p>
                    <p className="text-[11px] text-muted-foreground">Abra a página do teste, execute os passos e anexe o print abaixo.</p>
                  </div>
                  <button
                    onClick={() => window.open(manualTaskModal.targetUrl || projectUrl || "http://localhost:3000", "_blank")}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    🔗 Abrir Site
                  </button>
                </div>

                {/* Upload ou Paste de Evidência */}
                <div>
                  <h4 className="font-bold text-foreground mb-1.5 uppercase tracking-wider text-[11px] text-violet-400">
                    📸 Anexar Evidência da Execução Manual
                  </h4>
                  {manualEvidence ? (
                    <div className="relative rounded-xl overflow-hidden border border-border bg-black/40 p-2 flex justify-center items-center">
                      <img src={manualEvidence} alt="Evidência Manual" className="max-h-40 object-contain rounded-lg" />
                      <button
                        onClick={() => setManualEvidence(null)}
                        className="absolute top-3 right-3 bg-black/70 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg p-1.5 transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-border/80 hover:border-violet-500/50 rounded-xl p-4 text-center cursor-pointer transition-all bg-accent/20 hover:bg-accent/40 block">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setManualEvidence(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                      />
                      <p className="text-muted-foreground font-medium">
                        📸 Clique para enviar print ou <strong>pressione Ctrl+V</strong> para colar a imagem
                      </p>
                    </label>
                  )}
                </div>
              </div>

              {/* Rodapé com Ações */}
              <div className="bg-accent/20 border-t border-border px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={() => setManualTaskModal(null)}
                  className="px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
                >
                  Pular / Manter Estado
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      const t = manualTaskModal.task;
                      const newMeta = { 
                        ...(t.metadata || {}), 
                        manualStatus: "failed",
                        ...(manualEvidence ? { evidence: manualEvidence } : {})
                      };
                      await supabase.from("tasks").update({ status: "in_progress", metadata: newMeta, updated_at: new Date().toISOString() }).eq("id", t.id);
                      onTasksChange(tasks.map(x => x.id === t.id ? { ...x, status: "in_progress", metadata: newMeta } : x));
                      setManualTaskModal(null);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-bold transition-all"
                  >
                    ❌ Registrar Falha Manual
                  </button>

                  <button
                    onClick={async () => {
                      const supabase = createClient();
                      const t = manualTaskModal.task;
                      const newMeta = { 
                        ...(t.metadata || {}), 
                        manualStatus: "approved",
                        manualApprovedAt: new Date().toISOString(),
                        ...(manualEvidence ? { evidence: manualEvidence } : {})
                      };
                      delete (newMeta as any).automationCode;
                      await supabase.from("tasks").update({ status: "done", metadata: newMeta, updated_at: new Date().toISOString() }).eq("id", t.id);
                      onTasksChange(tasks.map(x => x.id === t.id ? { ...x, status: "done", metadata: newMeta } : x));
                      setManualTaskModal(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-1.5"
                  >
                    ✓ Aprovar Manualmente (Passou)
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
