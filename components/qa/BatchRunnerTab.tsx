"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Plus, Trash2, Globe, Clock, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";

interface BatchJob {
  id: string;
  targetUrl: string;
  jobName: string;
  flowDescription: string; // The script code / JSON
}

export function BatchRunnerTab() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [targetUrl, setTargetUrl] = useState("");
  const [jobName, setJobName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [progressMsg, setProgressMsg] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleAddJob = () => {
    if (!targetUrl.trim() || !flowDescription.trim()) return;
    const newJob: BatchJob = {
      id: Math.random().toString(36).substring(7),
      targetUrl: targetUrl.trim(),
      jobName: jobName.trim() || `Automação ${new URL(targetUrl.trim()).hostname}`,
      flowDescription: flowDescription.trim(),
    };
    setJobs([...jobs, newJob]);
    setTargetUrl("");
    setJobName("");
    setFlowDescription("");
  };

  const handleRemoveJob = (id: string) => {
    setJobs(jobs.filter((j) => j.id !== id));
  };

  const handleCancelBatch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSubmitting(false);
    setProgressMsg("");
    setErrorMsg("Execução do lote cancelada pelo usuário.");
  };

  const handleRunBatch = async () => {
    if (jobs.length === 0) return;
    setIsSubmitting(true);
    setResultMessage("");
    setErrorMsg("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let successCount = 0;

    try {
      for (let i = 0; i < jobs.length; i++) {
        if (controller.signal.aborted) break;

        const job = jobs[i];
        setProgressMsg(`Executando ${i + 1} de ${jobs.length}: ${job.jobName}...`);

        const res = await fetch("/api/automation/smart-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl: job.targetUrl,
            flowDescription: job.flowDescription,
            jobName: job.jobName,
            model: "auto-free",
            includeAxe: false,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error(`Erro no job ${job.jobName}:`, errData);
          continue;
        }

        successCount++;
      }

      if (!controller.signal.aborted) {
        setResultMessage(`${successCount} de ${jobs.length} testes concluídos e salvos no Histórico!`);
        if (successCount === jobs.length) setJobs([]);
      }
    } catch (e: any) {
      if (e.name === "AbortError" || controller.signal.aborted) {
        setErrorMsg("Execução do lote interrompida pelo usuário.");
      } else {
        setErrorMsg(e.message || "Erro inesperado ao executar o lote.");
      }
    } finally {
      setIsSubmitting(false);
      setProgressMsg("");
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulário de Adição */}
      <div className="bg-surface/50 rounded-2xl border border-border/50 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">Adicionar à Fila de Testes</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">URL Alvo</label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Nome da Auditoria</label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="Ex: Auditoria de Login"
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Roteiro / Instrução de Teste</label>
            <textarea
              value={flowDescription}
              onChange={(e) => setFlowDescription(e.target.value)}
              placeholder="Descreva o que o teste deve validar ou cole código Playwright..."
              className="w-full h-24 bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
            />
          </div>

          <button
            onClick={handleAddJob}
            disabled={!targetUrl.trim() || !flowDescription.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Adicionar à Fila
          </button>
        </div>
      </div>

      {/* Lista de Fila e Execução */}
      <div className="bg-surface/50 rounded-2xl border border-border/50 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Fila de Execução em Lote</h2>
            <p className="text-xs text-muted-foreground">{jobs.length} itens na fila</p>
          </div>

          <div className="flex items-center gap-2">
            {isSubmitting ? (
              <button
                onClick={handleCancelBatch}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <X className="w-4 h-4" />
                <span>Cancelar Lote</span>
              </button>
            ) : (
              <button
                onClick={handleRunBatch}
                disabled={jobs.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                <Play className="w-4 h-4 fill-current" />
                Rodar Lote no Servidor
              </button>
            )}
          </div>
        </div>

        {progressMsg && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between gap-3 text-primary text-sm font-semibold">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{progressMsg}</span>
            </div>
            <button
              onClick={handleCancelBatch}
              className="text-xs font-bold text-rose-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Parar
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-500 text-sm">
            <AlertCircle className="w-4 h-4" /> {errorMsg}
          </div>
        )}

        {resultMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-500 text-sm">
            <CheckCircle2 className="w-4 h-4" /> {resultMessage}
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
            Fila vazia. Adicione testes acima.
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {jobs.map((job, idx) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between p-4 bg-background border border-border rounded-xl hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-xs">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{job.jobName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Globe className="w-3 h-3 shrink-0" /> {job.targetUrl}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveJob(job.id)}
                    disabled={isSubmitting}
                    className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0 disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Os testes em lote são executados de forma invisível em background. Você poderá acessar os resultados na aba "Histórico" assim que concluídos.
        </div>
      </div>
    </div>
  );
}
