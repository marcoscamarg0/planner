"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, CheckSquare, Circle, Clock, XCircle, Sparkles, Maximize2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { cn, getPriorityColor, getPriorityLabel, getStatusLabel, formatDate } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import { TaskDetailPane } from "./TaskDetailPane";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTaskId = searchParams.get("taskId");

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [subtaskFormId, setSubtaskFormId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const filteredTasks =
    filterStatus === "all"
      ? tasks
      : tasks.filter((t) => t.status === filterStatus);



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
        tasks={tasks}
        onTasksChange={onTasksChange}
        onClose={() => router.push(`?`)}
      />
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
          {filteredTasks.filter(t => !t.parent_task_id).map((task, i) => {
            const StatusIcon = STATUS_ICON[task.status];
            const taskSubtasks = tasks.filter(t => t.parent_task_id === task.id && (filterStatus === "all" || t.status === filterStatus));
            
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
                    "flex items-start gap-3 px-4 py-3 rounded-xl glass-hover group flex-col sm:flex-row relative",
                    task.status === "done" && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3 w-full z-10">
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
                            onClick={() => router.push(`?taskId=${task.id}`)}
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
                      className="ml-8 mt-2 flex items-center gap-2 glass rounded-xl px-4 py-2 relative overflow-hidden"
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
                            "flex items-start gap-3 px-4 py-2 rounded-xl glass-hover group flex-col sm:flex-row",
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
                                    onClick={() => router.push(`?taskId=${subtask.id}`)}
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
