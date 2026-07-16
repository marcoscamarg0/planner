"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, CheckSquare, Circle, Clock, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, getPriorityColor, getPriorityLabel, getStatusLabel, formatDate } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "@/types";

interface TaskPanelProps {
  tasks: Task[];
  projectId: string;
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

export function TaskPanel({ tasks, projectId, onTasksChange }: TaskPanelProps) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const filteredTasks =
    filterStatus === "all"
      ? tasks
      : tasks.filter((t) => t.status === filterStatus);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setAdding(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        title: newTitle.trim(),
        status: "todo",
        priority: "medium",
      })
      .select()
      .single();

    if (data) {
      onTasksChange([data as Task, ...tasks]);
      setNewTitle("");
      setShowForm(false);
    }
    setAdding(false);
  };

  const cycleStatus = async (task: Task) => {
    const nextStatus = STATUS_CYCLE[task.status];
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", task.id);

    onTasksChange(
      tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
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
        <button
          id="add-task-btn"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova tarefa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={addTask}
              className="flex items-center gap-2 glass rounded-xl px-4 py-3"
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
          {filteredTasks.map((task, i) => {
            const StatusIcon = STATUS_ICON[task.status];
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 rounded-xl glass-hover group flex-col sm:flex-row",
                  task.status === "done" && "opacity-60"
                )}
              >
                <div className="flex items-start gap-3 w-full">
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
                    
                    <AnimatePresence>
                      {expandedTaskId === task.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 overflow-hidden"
                        >
                          <textarea
                            defaultValue={task.description || ""}
                            onBlur={(e) => updateDescription(task.id, e.target.value)}
                            placeholder="Adicionar observações detalhadas..."
                            className="w-full text-xs bg-black/10 dark:bg-black/40 text-foreground placeholder:text-muted-foreground rounded-lg p-3 outline-none border border-border/50 resize-y min-h-[80px] focus:border-primary/50 transition-colors"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

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
                      
                      <button
                        onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                        className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 ml-auto sm:ml-0"
                      >
                        {task.description ? "📝 VER OBSERVAÇÕES" : "➕ OBSERVAÇÕES"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {filterStatus === "all"
                ? "Nenhuma tarefa ainda"
                : `Nenhuma tarefa ${statusLabel[filterStatus].toLowerCase()}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
