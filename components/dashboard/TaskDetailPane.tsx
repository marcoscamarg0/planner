"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2, Zap, Printer, Image as ImageIcon, Play, CheckCircle2, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, getPriorityColor, getPriorityLabel, getStatusLabel, formatDate } from "@/lib/utils";
import type { Task, TaskPriority } from "@/types";

interface TaskDetailPaneProps {
  taskId: string | null;
  onClose: () => void;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  projectUrl?: string;
}

export function TaskDetailPane({ taskId, onClose, tasks, onTasksChange, projectUrl }: TaskDetailPaneProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [description, setDescription] = useState("");
  const [running, setRunning] = useState(false);
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<any>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (taskId) {
      const found = tasks.find(t => t.id === taskId);
      if (found) {
        setTask(found);
        setDescription(found.description || "");
        setRunResult(found.metadata?.lastRunResult || null);
      }
    } else {
      setTask(null);
      setRunResult(null);
    }
  }, [taskId, tasks]);

  const updateField = async (field: Partial<Task>) => {
    if (!task) return;
    const supabase = createClient();
    
    // Se o status for concluído, remova o código de automação
    if (field.status === "done") {
      let currentMetadata = field.metadata || task.metadata || {};
      if (currentMetadata.automationCode) {
        currentMetadata = { ...currentMetadata };
        delete currentMetadata.automationCode;
        field.metadata = currentMetadata;
        setShowCode(false); // Esconde a UI caso estivesse aberta
      }
    }

    await supabase.from("tasks").update(field).eq("id", task.id);
    onTasksChange(tasks.map(t => (t.id === task.id ? { ...t, ...field } : t)));
  };

  const handleBlurDescription = () => {
    if (task && description !== task.description) {
      updateField({ description });
    }
  };

  const generateTaskPlan = async () => {
    if (!task) return;
    setLoadingPlan(true);
    try {
      const res = await fetch("/api/ai/task-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: task.title,
          projectTitle: document.querySelector("h2")?.innerText || ""
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.plan) {
          const newDesc = description 
            ? description + "\n\n---\n**Plano de Ação (IA)**:\n" + data.plan 
            : "**Plano de Ação (IA)**:\n" + data.plan;
          
          setDescription(newDesc);
          await updateField({ description: newDesc });
        }
      } else {
        alert("Falha ao gerar plano de ação.");
      }
    } catch (e) {
      alert("Erro ao conectar com a IA.");
    } finally {
      setLoadingPlan(false);
    }
  };

  const generateTaskAutomation = async () => {
    if (!task) return;
    setLoadingAuto(true);
    
    // Altera o status da tarefa para Em Progresso
    if (task.status !== "in_progress") {
      await updateField({ status: "in_progress" as any });
    }

    try {
      const res = await fetch("/api/ai/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_type: "automation",
          input: `Título da Tarefa: ${task.title}\n\nDescrição e Passos:\n${description}`,
          model: "auto-free", // usa o modelo default auto-free
          project_id: task.project_id
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          const codeBlock = data.result.includes("```") ? data.result : `\`\`\`javascript\n${data.result}\n\`\`\``;
          const newMetadata = { ...(task.metadata || {}), automationCode: codeBlock };
          
          await updateField({ metadata: newMetadata });
        }
      } else {
        alert("Falha ao gerar automação.");
      }
    } catch (e) {
      alert("Erro ao conectar com a IA.");
    } finally {
      setLoadingAuto(false);
    }
  };

  const executeTaskAutomation = async () => {
    if (!task) return;
    
    const rawCode = (task.metadata?.automationCode as string) || "";
    
    // Tenta extrair a URL do código de automação ou da descrição para usar como sugestão
    const urlFromCode = rawCode.match(/goto\(['"]([^'"]+)['"]\)/)?.[1];
    const urlFromDesc = description.match(/https?:\/\/\S+/)?.[0]?.replace(/[.,;:)]$/, '');
    const suggestedUrl = urlFromCode || urlFromDesc || projectUrl || "http://localhost:3000";
    
    // Sempre pergunta a URL ao usuário — URL extraída aparece como valor padrão
    const targetUrl = prompt("Qual a URL alvo para executar o teste?", suggestedUrl);
    if (!targetUrl) return;

    // Monta o flowDescription a partir dos passos reais da tarefa (não do código gerado)
    // Isso garante que o SmartRun gere passos corretos baseados no plano de QA real
    const flowDescription = [
      `**Título do Caso de Teste:** ${task.title}`,
      ``,
      description.trim(),
    ].join("\n");

    // Altera o status da tarefa para Em Progresso
    if (task.status !== "in_progress") {
      await updateField({ status: "in_progress" as any });
    }

    setRunning(true);
    setRunLogs([]);
    setRunResult(null);

    try {
      const res = await fetch("/api/automation/smart-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          flowDescription,
          jobName: task.title,
          model: "auto-free",
          includeAxe: false
        })
      });

      if (!res.body) throw new Error("Sem resposta do servidor");
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
            const parsed = JSON.parse(line);
            if (parsed.type === "log") {
              setRunLogs(prev => [...prev, parsed.message || ""]);
            } else if (parsed.type === "result") {
              setRunResult(parsed.data);
              // Salva permanentemente o resultado da execução na tarefa!
              const newMetadata = { ...(task.metadata || {}), lastRunResult: parsed.data };
              updateField({ metadata: newMetadata });
            } else if (parsed.type === "error") {
              setRunLogs(prev => [...prev, "ERRO: " + parsed.error]);
            }
          } catch (e) {}
        }
      }
    } catch (e: any) {
      setRunLogs(prev => [...prev, "Falha na execução: " + e.message]);
    } finally {
      setRunning(false);
    }
  };

  const downloadTaskPDF = () => {
    if (!task) return;
    const date = new Date().toLocaleDateString('pt-BR');
    const descFormatted = description.replace(/\n/g, '<br/>');
    const evidenceImg = task.metadata?.evidence ? `<div style="margin-top:20px;"><h3>Evidência Anexada</h3><img src="${task.metadata.evidence}" style="max-width:100%; border:1px solid #ccc; border-radius:8px;" /></div>` : '';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Relatório - ${task.title}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
          h1 { margin-bottom: 5px; color: #0f172a; }
          .meta { color: #64748b; font-size: 12px; margin-bottom: 30px; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #f1f5f9; font-weight: bold; text-transform: uppercase; border: 1px solid #e2e8f0; }
          .content { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 20px; white-space: pre-wrap; font-family: monospace; font-size: 13px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>${task.title}</h1>
        <div class="meta">
          Gerado em: ${date} &bull; <span class="badge">${task.priority}</span> &bull; <span class="badge">${task.status}</span>
        </div>
        
        <h3>Descrição / Passos</h3>
        <div class="content">${descFormatted}</div>
        
        ${evidenceImg}
        
        <script>window.onload=()=>{window.print();}</script>
      </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute inset-y-0 right-0 w-full md:w-[450px] bg-card border-l border-border shadow-2xl z-40 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground uppercase text-xs tracking-wider">Detalhes da Tarefa</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadTaskPDF}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors text-xs font-semibold border border-border"
              >
                <Printer className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <div>
              <input
                type="text"
                value={task.title}
                onChange={(e) => {
                  setTask({ ...task, title: e.target.value });
                }}
                onBlur={(e) => updateField({ title: e.target.value })}
                className="w-full text-xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground mb-4"
                placeholder="Título da tarefa..."
              />
              
              <div className="flex flex-wrap items-center gap-4 text-sm mt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</span>
                  <select
                    value={task.status}
                    onChange={(e) => updateField({ status: e.target.value as any })}
                    className="bg-accent/50 text-foreground px-2 py-1 rounded border border-border/50 outline-none text-xs"
                  >
                    <option value="todo">{getStatusLabel("todo")}</option>
                    <option value="in_progress">{getStatusLabel("in_progress")}</option>
                    <option value="done">{getStatusLabel("done")}</option>
                    <option value="cancelled">{getStatusLabel("cancelled")}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prioridade</span>
                  <select
                    value={task.priority}
                    onChange={(e) => updateField({ priority: e.target.value as TaskPriority })}
                    className={cn(
                      "px-2 py-1 rounded border border-border/50 outline-none text-xs font-medium uppercase",
                      getPriorityColor(task.priority),
                      "bg-accent/50"
                    )}
                  >
                    {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
                      <option key={p} value={p} className="bg-card text-foreground">{getPriorityLabel(p)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground">O que fazer (Plano)</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={generateTaskAutomation}
                    disabled={loadingAuto || loadingPlan}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {loadingAuto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    {loadingAuto ? "Gerando Automação..." : "Gerar Automação"}
                  </button>
                  <button
                    onClick={generateTaskPlan}
                    disabled={loadingPlan || loadingAuto}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {loadingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {loadingPlan ? "Gerando..." : "Gerar Plano"}
                  </button>
                  {!!task.metadata?.automationCode && (
                    <button
                      onClick={executeTaskAutomation}
                      disabled={running}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-500 text-xs font-medium hover:bg-sky-500/20 transition-colors disabled:opacity-50 border border-sky-500/20 shadow-sm"
                    >
                      {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {running ? "Executando..." : "Testar Automação"}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleBlurDescription}
                placeholder="Descreva o passo a passo da tarefa ou use a IA para gerar um plano..."
                className="w-full h-[250px] bg-black/10 dark:bg-black/40 text-sm text-foreground placeholder:text-muted-foreground rounded-xl p-4 outline-none border border-border/50 resize-y focus:border-primary/50 transition-colors font-mono leading-relaxed"
              />

              {!!task.metadata?.automationCode && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Código de Automação (Oculto)</h3>
                    </div>
                    <button
                      onClick={() => setShowCode(!showCode)}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      {showCode ? "Ocultar Código" : "Ver Código"}
                    </button>
                  </div>
                  {showCode && (
                    <pre className="bg-black/50 text-[10px] text-sky-300 p-4 rounded-xl overflow-x-auto max-h-[300px] border border-border/50 font-mono">
                      {String(task.metadata.automationCode)}
                    </pre>
                  )}
                </div>
              )}
              
              {task.metadata?.evidence && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="w-4 h-4 text-sky-500" />
                    <h3 className="text-sm font-semibold text-foreground">Evidência Anexada</h3>
                  </div>
                  <div className="relative rounded-lg overflow-hidden border border-border bg-black/25 flex justify-center items-center">
                    <img src={task.metadata.evidence as string} alt="Evidência" className="max-h-48 object-contain" />
                  </div>
                </div>
              )}

              {/* Console de Execução */}
              {(running || runLogs.length > 0 || runResult) && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-sky-500" />
                    <h3 className="text-sm font-semibold text-foreground">Console do Runner</h3>
                  </div>
                  <div className="bg-black/50 border border-border/50 rounded-xl p-4 font-mono text-[10px] sm:text-xs text-sky-300 max-h-60 overflow-y-auto space-y-1">
                    {runLogs.map((log, i) => (
                      <div key={i} className={log.includes("ERRO") ? "text-rose-400" : "text-sky-300/80"}>
                        <span className="text-muted-foreground mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                      </div>
                    ))}
                    {running && (
                      <div className="flex items-center gap-2 text-sky-400/50 mt-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Processando...
                      </div>
                    )}
                    {runResult && (
                      <div className="mt-4 pt-3 border-t border-sky-500/20 text-emerald-400 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Execução concluída!
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {runResult.pdfUrl && (
                            <a href={runResult.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-emerald-500/20 px-2 py-1 rounded text-emerald-400 hover:bg-emerald-500/30 transition-colors font-sans">
                              <FileText className="w-3.5 h-3.5" /> PDF
                            </a>
                          )}
                          {runResult.htmlReportUrl && (
                            <a href={runResult.htmlReportUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-sky-500/20 px-2 py-1 rounded text-sky-400 hover:bg-sky-500/30 transition-colors font-sans">
                              <Sparkles className="w-3.5 h-3.5" /> HTML
                            </a>
                          )}
                          {runResult.reportId && (
                            <button 
                              onClick={() => {
                                const url = `${window.location.origin}/share/${runResult.reportId}`;
                                navigator.clipboard.writeText(url).then(() => alert("Link de compartilhamento copiado!"));
                              }}
                              className="flex items-center gap-1 bg-indigo-500/20 px-2 py-1 rounded text-indigo-400 hover:bg-indigo-500/30 transition-colors font-sans cursor-pointer"
                              title="Copiar Link de Compartilhamento"
                            >
                              Compartilhar Público
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">A IA tem acesso a esta tela</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Use o chat lateral para discutir essa tarefa.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
