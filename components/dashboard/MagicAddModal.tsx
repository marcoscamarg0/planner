"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Loader2, Check, Command, ChevronDown, ListChecks, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { Project } from "@/types";

interface MagicAddModalProps {
  open: boolean;
  onClose: () => void;
  projects?: Project[];
}

interface ResultState {
  tasksCreated: number;
  summary: string | null;
  projectId: string;
  projectTitle: string;
}

export function MagicAddModal({ open, onClose, projects = [] }: MagicAddModalProps) {
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const selectedProject = projects.find((p) => p.id === projectId);

  const handleClose = () => {
    setText("");
    setProjectId("");
    setResult(null);
    setError(null);
    setLoading(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);

    // Fluxo explícito: projeto escolhido -> extração estruturada (tarefas + resumo)
    // Fluxo automático: sem projeto -> IA tenta detectar a intenção/projeto sozinha
    setLoading(true);
    try {
      if (projectId) {
        const res = await fetch("/api/ai/magic-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), projectId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao processar a mensagem");

        setResult({
          tasksCreated: data.results?.tasksCreated ?? 0,
          summary: data.results?.summary ?? null,
          projectId,
          projectTitle: selectedProject?.title ?? "Projeto",
        });
      } else {
        const res = await fetch("/api/ai/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: text.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao processar o comando");

        setResult({
          tasksCreated: data.raw?.tasks?.length ?? 0,
          summary: data.raw?.note ?? data.actionTaken ?? null,
          projectId: data.targetProjectId,
          projectTitle: projects.find((p) => p.id === data.targetProjectId)?.title ?? "",
        });
      }
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const goToProject = () => {
    if (result?.projectId) {
      router.push(`/projects/${result.projectId}`);
      router.refresh();
    }
    handleClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            onClick={!loading ? handleClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="magic-add-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[70] px-4"
          >
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
              {/* Decorative background glow */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Command className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2
                      id="magic-add-title"
                      className="text-lg font-semibold text-foreground tracking-tight leading-none"
                    >
                      Magic Add
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cole uma mensagem do Teams, e-mail ou ata
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  aria-label="Fechar"
                  className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {result ? (
                <div className="relative z-10 space-y-4">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2 text-emerald-500 font-medium text-sm mb-3">
                      <Check className="w-4 h-4" />
                      Processado{result.projectTitle ? ` em "${result.projectTitle}"` : ""}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-foreground mb-2">
                      <ListChecks className="w-4 h-4 text-muted-foreground shrink-0" />
                      {result.tasksCreated > 0
                        ? `${result.tasksCreated} tarefa${result.tasksCreated > 1 ? "s" : ""} criada${result.tasksCreated > 1 ? "s" : ""}`
                        : "Nenhuma tarefa identificada"}
                    </div>

                    {result.summary && (
                      <div className="flex items-start gap-2 text-sm text-foreground/90 mt-2">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="leading-relaxed">{result.summary}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleClose}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      Fechar
                    </button>
                    {result.projectId && (
                      <button
                        onClick={goToProject}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        Ver projeto
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      Projeto de destino
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setProjectPickerOpen((v) => !v)}
                        disabled={loading}
                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground hover:bg-secondary transition-colors"
                      >
                        <span className="flex items-center gap-2 truncate">
                          {selectedProject ? (
                            <>
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: selectedProject.color }}
                              />
                              {selectedProject.title}
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Detectar automaticamente (IA escolhe)
                            </span>
                          )}
                        </span>
                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", projectPickerOpen && "rotate-180")} />
                      </button>

                      <AnimatePresence>
                        {projectPickerOpen && (
                          <>
                            <div className="fixed inset-0 z-[75]" onClick={() => setProjectPickerOpen(false)} />
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 6 }}
                              transition={{ duration: 0.12 }}
                              className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-[80] p-1"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setProjectId("");
                                  setProjectPickerOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
                              >
                                Detectar automaticamente (IA escolhe)
                              </button>
                              {projects.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setProjectId(p.id);
                                    setProjectPickerOpen(false);
                                  }}
                                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent transition-colors"
                                >
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                  <span className="truncate">{p.title}</span>
                                </button>
                              ))}
                              {projects.length === 0 && (
                                <p className="px-3 py-2 text-xs text-muted-foreground">
                                  Você ainda não tem projetos.
                                </p>
                              )}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground flex items-center justify-between">
                      Mensagem
                      <span className="text-xs text-muted-foreground font-normal">
                        A IA extrai tarefas e um resumo
                      </span>
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={loading}
                      placeholder="Cole aqui a mensagem copiada do Teams, e-mail ou ata de reunião..."
                      rows={6}
                      className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all"
                      autoFocus
                    />
                  </div>

                  {error && <p className="text-xs text-destructive">{error}</p>}

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={loading || !text.trim()}
                      className={cn(
                        "w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300",
                        "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
                        "disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      )}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          A IA está processando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          {projectId ? "Criar tarefas e resumo" : "Executar"}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
