"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, getPriorityColor, getPriorityLabel, getStatusLabel, formatDate } from "@/lib/utils";
import type { Task, TaskPriority } from "@/types";

interface TaskDetailPaneProps {
  taskId: string | null;
  onClose: () => void;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

export function TaskDetailPane({ taskId, onClose, tasks, onTasksChange }: TaskDetailPaneProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (taskId) {
      const found = tasks.find(t => t.id === taskId);
      if (found) {
        setTask(found);
        setDescription(found.description || "");
      }
    } else {
      setTask(null);
    }
  }, [taskId, tasks]);

  const updateField = async (field: Partial<Task>) => {
    if (!task) return;
    const supabase = createClient();
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
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">O que fazer (Plano)</h3>
                <button
                  onClick={generateTaskPlan}
                  disabled={loadingPlan}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {loadingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {loadingPlan ? "Gerando..." : "Gerar com IA"}
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleBlurDescription}
                placeholder="Descreva o passo a passo da tarefa ou use a IA para gerar um plano..."
                className="w-full h-[300px] bg-black/10 dark:bg-black/40 text-sm text-foreground placeholder:text-muted-foreground rounded-xl p-4 outline-none border border-border/50 resize-y focus:border-primary/50 transition-colors font-mono leading-relaxed"
              />
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
