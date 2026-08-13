"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Plus, Trash2, Globe, Clock, CheckCircle2, AlertCircle } from "lucide-react";

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

  const handleAddJob = () => {
    if (!targetUrl.trim() || !flowDescription.trim()) return;
    const newJob: BatchJob = {
      id: Math.random().toString(36).substring(7),
      targetUrl: targetUrl.trim(),
      jobName: jobName.trim() || `Automação ${new URL(targetUrl.trim()).hostname}`,
      flowDescription: flowDescription.trim()
    };
    setJobs([...jobs, newJob]);
    setTargetUrl("");
    setJobName("");
    setFlowDescription("");
  };

  const handleRemoveJob = (id: string) => {
    setJobs(jobs.filter(j => j.id !== id));
  };

  const [progressMsg, setProgressMsg] = useState("");

  const handleRunBatch = async () => {
    if (jobs.length === 0) return;
    setIsSubmitting(true);
    setResultMessage("");
    setErrorMsg("");

    let successCount = 0;
    
    try {
      for (let i = 0; i < jobs.length; i++) {
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
            includeAxe: false
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error(`Erro no job ${job.jobName}:`, errData);
          continue; // Pula para o próximo em caso de erro
        }
        
        successCount++;
      }

      setResultMessage(`${successCount} de ${jobs.length} testes concluídos e salvos no Histórico!`);
      if (successCount === jobs.length) setJobs([]); // Limpa a fila se todos passaram
    } catch (e: any) {
      setErrorMsg(e.message || "Erro inesperado ao executar o lote.");
    } finally {
      setIsSubmitting(false);
      setProgressMsg("");
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
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Nome do Teste (Opcional)</label>
              <input 
                type="text" 
                value={jobName}
                onChange={e => setJobName(e.target.value)}
                placeholder="Ex: Fluxo de Login"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Passos ou Script (JSON/Playwright)</label>
            <textarea 
              value={flowDescription}
              onChange={e => setFlowDescription(e.target.value)}
              placeholder="Cole o script do Playwright Codegen, JSON de passos ou descrição do fluxo..."
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono min-h-[120px] resize-y"
            />
          </div>
          <div className="flex justify-end">
            <button 
              onClick={handleAddJob}
              disabled={!targetUrl.trim() || !flowDescription.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-sm font-semibold hover:bg-secondary/80 transition-all disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Adicionar à Fila
            </button>
          </div>
        </div>
      </div>

      {/* Lista da Fila */}
      <div className="bg-surface/50 rounded-2xl border border-border/50 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            Fila de Execução 
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">{jobs.length}</span>
          </h2>
          <button 
            onClick={handleRunBatch}
            disabled={jobs.length === 0 || isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isSubmitting ? <Clock className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Rodar Lote no Servidor
          </button>
        </div>

        {progressMsg && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-2 text-primary text-sm font-semibold animate-pulse">
            <Clock className="w-4 h-4 animate-spin" /> {progressMsg}
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
                    className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Os testes em lote são executados de forma invisível em background. Você poderá acessar os resultados na aba "Histórico" (ou recarregando a página) assim que concluídos.
        </div>
      </div>
    </div>
  );
}
