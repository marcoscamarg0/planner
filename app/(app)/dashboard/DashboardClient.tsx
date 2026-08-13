"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderKanban,
  CheckSquare,
  FlaskConical,
  CheckCircle2,
  X,
  Loader2,
  ChevronRight,
  AlertCircle,
  Clock,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import type { Profile, ProjectWithStats, Task, DashboardStats } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { InsightBadge } from "@/components/dashboard/InsightBadge";
import { createClient } from "@/lib/supabase/client";

interface DashboardClientProps {
  profile: Profile | null;
  projectsWithStats: ProjectWithStats[];
  allTasks: Task[];
  stats: DashboardStats;
}

interface ActivityItem {
  id: string;
  type: "project_updated" | "task_completed";
  title: string;
  description: string;
  date: Date;
  icon: any;
  color: string;
}

interface QaTestCase {
  id: string;
  title: string;
  category: string;
  priority: string;
  steps: string[];
  expected_result: string;
}

interface QaReport {
  id: string;
  type: string;
  title: string;
  created_at: string;
  result_json: { test_cases?: QaTestCase[] } | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  alta:   "text-rose-400 bg-rose-400/10 border border-rose-400/20",
  media:  "text-amber-400 bg-amber-400/10 border border-amber-400/20",
  média:  "text-amber-400 bg-amber-400/10 border border-amber-400/20",
  baixa:  "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20",
  high:   "text-rose-400 bg-rose-400/10 border border-rose-400/20",
  medium: "text-amber-400 bg-amber-400/10 border border-amber-400/20",
  low:    "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20",
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  happy_path: CheckCircle2,
  error:      AlertCircle,
  edge_case:  TriangleAlert,
};

const CATEGORY_COLOR: Record<string, string> = {
  happy_path: "text-emerald-400",
  error:      "text-rose-400",
  edge_case:  "text-amber-400",
};

// ─────────────────────────────────────────────
export function DashboardClient({
  profile,
  projectsWithStats: initialProjects,
  allTasks: initialTasks,
  stats,
}: DashboardClientProps) {
  const [dashboardInsight, setDashboardInsight] = useState<string | null>(null);

  // ── Realtime tasks state ────────────────────
  // All task mutations arrive via Supabase channel and update this list.
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [projects] = useState<ProjectWithStats[]>(initialProjects);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [liveIndicator, setLiveIndicator] = useState(false);

  // ── Test panel state ────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [testReports, setTestReports] = useState<QaReport[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const supabaseRef = useRef(createClient());

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };
  const firstName = profile?.full_name?.split(" ")[0] ?? "Usuário";

  // ── Build activity feed ─────────────────────
  const buildFeed = useCallback((currentTasks: Task[], currentProjects: ProjectWithStats[]) => {
    const parseDateSafe = (d?: string | Date | null) => {
      if (!d) return new Date();
      const p = new Date(d);
      return isNaN(p.getTime()) ? new Date() : p;
    };

    const feed: ActivityItem[] = [];

    currentProjects.slice(0, 5).forEach((p) =>
      feed.push({
        id: `p-${p.id}`,
        type: "project_updated",
        title: p.title,
        description: "Projeto atualizado recentemente",
        date: parseDateSafe(p.updated_at),
        icon: FolderKanban,
        color: "text-blue-500 bg-blue-500/10",
      })
    );

    currentTasks
      .filter((t) => t.status === "done" && t.title)
      .slice(0, 8)
      .forEach((t) =>
        feed.push({
          id: `t-${t.id}`,
          type: "task_completed",
          title: t.title,
          description: "Tarefa marcada como concluída",
          date: parseDateSafe(t.updated_at),
          icon: CheckSquare,
          color: "text-emerald-500 bg-emerald-500/10",
        })
      );

    feed.sort((a, b) => b.date.getTime() - a.date.getTime());
    setActivities(feed.slice(0, 12));
  }, []);

  // Initial feed build + immediate client-side fetch to hydrate fresh data
  useEffect(() => {
    buildFeed(initialTasks, initialProjects);

    // Fetch tarefas frescas do Supabase logo ao montar
    // (dados SSR podem estar desatualizados)
    const projectIds = initialProjects.map((p) => p.id);
    if (projectIds.length === 0) return;

    supabaseRef.current
      .from("tasks")
      .select("*")
      .in("project_id", projectIds)
      .order("updated_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTasks(data as Task[]);
          buildFeed(data as Task[], initialProjects);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Polling de fallback a cada 20s ──────────
  // Garante atualização mesmo sem a migration de Realtime executada.
  useEffect(() => {
    const projectIds = initialProjects.map((p) => p.id);
    if (projectIds.length === 0) return;

    const poll = async () => {
      try {
        const { data } = await supabaseRef.current
          .from("tasks")
          .select("id, project_id, title, status, updated_at, priority, due_date")
          .in("project_id", projectIds)
          .order("updated_at", { ascending: false })
          .limit(100);

        if (data) {
          setTasks((prev) => {
            // Só atualiza se algo realmente mudou
            const changed =
              data.length !== prev.length ||
              data.some((d) => {
                const existing = prev.find((p) => p.id === d.id);
                return !existing || existing.status !== d.status || existing.updated_at !== d.updated_at;
              });
            if (!changed) return prev;
            buildFeed(data as Task[], initialProjects);
            setLiveIndicator(true);
            setTimeout(() => setLiveIndicator(false), 800);
            return data as Task[];
          });
        }
      } catch {}
    };

    const interval = setInterval(poll, 20_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Supabase Realtime: tasks channel ────────
  useEffect(() => {
    const supabase = supabaseRef.current;

    const flash = () => {
      setLiveIndicator(true);
      setTimeout(() => setLiveIndicator(false), 800);
    };

    const channel = supabase
      .channel("dashboard_tasks")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks" },
        (payload) => {
          const newTask = payload.new as Task;
          setTasks((prev) => {
            if (prev.find((t) => t.id === newTask.id)) return prev;
            const next = [newTask, ...prev];
            buildFeed(next, projects);
            return next;
          });
          flash();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks" },
        (payload) => {
          const updated = payload.new as Task;
          setTasks((prev) => {
            const next = prev.map((t) => (t.id === updated.id ? updated : t));
            buildFeed(next, projects);
            return next;
          });
          flash();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tasks" },
        (payload) => {
          const deletedId = payload.old.id;
          setTasks((prev) => {
            const next = prev.filter((t) => t.id !== deletedId);
            buildFeed(next, projects);
            return next;
          });
          flash();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [buildFeed, projects]);

  // ── AI Insight (once on mount) ──────────────
  useEffect(() => {
    if (initialProjects.length === 0) return;
    const run = async () => {
      try {
        const res = await fetch("/api/ai/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectTitle: "todos os projetos",
            stats: {
              total_tasks: stats.total_tasks,
              completed_tasks: stats.completed_tasks,
              pages_count: initialProjects.reduce((a, p) => a + p.pages_count, 0),
              status: "active",
            },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setDashboardInsight(data.insight);
        }
      } catch {}
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Test panel ──────────────────────────────
  const openTestPanel = async () => {
    setPanelOpen(true);
    if (testReports.length > 0) return;
    setLoadingReports(true);
    try {
      const { data } = await supabaseRef.current
        .from("qa_reports")
        .select("id, type, title, created_at, result_json")
        .eq("type", "test_cases")
        .order("created_at", { ascending: false })
        .limit(50);
      setTestReports((data as QaReport[]) ?? []);
    } catch {
      setTestReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const totalTestCases = testReports.reduce(
    (sum, r) => sum + (r.result_json?.test_cases?.length ?? 0),
    0
  );

  const deleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja apagar este plano de teste?")) return;
    
    // Otimista
    setTestReports(prev => prev.filter(r => r.id !== reportId));
    
    try {
      await supabaseRef.current.from("qa_reports").delete().eq("id", reportId);
    } catch {
      // silencioso
    }
  };

  // ── Derived counters from live tasks state ──
  const activeProjectIds = new Set(projects.filter(p => p.status === "active").map(p => p.id));

  const pendingTasksList = tasks.filter(
    (t) => {
      const titleStr = String(t.title || "");
      return activeProjectIds.has(t.project_id) && t.status !== "done" && t.status !== "cancelled" && titleStr.trim() !== "" && !titleStr.startsWith("[QA]") && !t.parent_task_id;
    }
  );
  const pendingTasksCount = pendingTasksList.length;

  // "Concluídos" = tarefas com status "done" — atualiza em tempo real via subscription
  const completedTasksCount = tasks.filter(
    (t) => {
      const titleStr = String(t.title || "");
      return activeProjectIds.has(t.project_id) && t.status === "done" && titleStr.trim() !== "" && !titleStr.startsWith("[QA]") && !t.parent_task_id;
    }
  ).length;

  // ───────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight font-outfit text-foreground">
              {greeting()}, {firstName}.
            </h1>
            <p className="text-muted-foreground text-sm">
              Aqui está o que precisa da sua atenção hoje.
            </p>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1.5 shrink-0">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                liveIndicator
                  ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]"
                  : "bg-emerald-500/50"
              )}
            />
            <span className="hidden sm:inline">ao vivo</span>
          </div>
        </div>

        {dashboardInsight && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4"
          >
            <InsightBadge content={dashboardInsight} type="progress" compact />
          </motion.div>
        )}
      </header>

      {/* ── Stats cards ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Visão Geral
        </h2>

        {/* DEBUG BOX */}
        {pendingTasksList.length > 0 && (
          <div className="p-4 bg-red-100 text-red-900 border border-red-300 rounded-lg mb-4">
            <h3 className="font-bold">DEBUG: Tarefas Pendentes Fantasmas</h3>
            <ul className="list-disc pl-5 text-sm">
              {pendingTasksList.map(t => (
                <li key={t.id}>
                  <strong>Título:</strong> "{t.title}" | <strong>Status:</strong> {t.status} | <strong>Projeto:</strong> {projects.find(p => p.id === t.project_id)?.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Projetos Ativos */}
          <div className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface hover:bg-accent transition-colors">
            <span className="text-xs text-muted-foreground font-medium">Projetos Ativos</span>
            <span className="text-2xl font-semibold text-foreground font-outfit">
              {stats.active_projects}
            </span>
          </div>

          {/* Tarefas Pendentes — live */}
          <div className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface hover:bg-accent transition-colors">
            <span className="text-xs text-muted-foreground font-medium">Tarefas Pendentes</span>
            <motion.span
              key={pendingTasksCount}
              initial={{ scale: 1.15, color: "rgb(251,191,36)" }}
              animate={{ scale: 1, color: "inherit" }}
              transition={{ duration: 0.3 }}
              className="text-2xl font-semibold text-foreground font-outfit"
            >
              {pendingTasksCount}
            </motion.span>
          </div>

          {/* Testes a Fazer — clicável */}
          <button
            onClick={openTestPanel}
            className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface hover:bg-accent transition-colors text-left group relative cursor-pointer"
          >
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <FlaskConical className="w-3 h-3" />
              Testes a Fazer
            </span>
            <span className="text-2xl font-semibold text-foreground font-outfit">
              {stats.qa_pending}
            </span>
            <span className="absolute bottom-2 right-3 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              ver <ChevronRight className="w-3 h-3" />
            </span>
          </button>

          {/* Concluídos — live, baseado em tarefas com status "done" */}
          <div className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-surface hover:bg-accent transition-colors">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Concluídos
            </span>
            <motion.span
              key={completedTasksCount}
              initial={{ scale: 1.15, color: "rgb(52,211,153)" }}
              animate={{ scale: 1, color: "inherit" }}
              transition={{ duration: 0.3 }}
              className="text-2xl font-semibold text-foreground font-outfit"
            >
              {completedTasksCount}
            </motion.span>
          </div>
        </div>
      </section>

      {/* ── Activity feed ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          Feed de Atividade
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors duration-300",
              liveIndicator
                ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]"
                : "bg-emerald-500/40"
            )}
          />
        </h2>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem atividades recentes.</div>
          ) : (
            <div className="relative border-l border-border ml-3 space-y-6 pb-4">
              <AnimatePresence initial={false}>
                {activities.map((activity, i) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -12, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0, x: -12, height: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    className="relative pl-6"
                  >
                    <div
                      className={cn(
                        "absolute -left-3.5 top-0 w-7 h-7 rounded-full border-[3px] border-background flex items-center justify-center",
                        activity.color
                      )}
                    >
                      <activity.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                      <span className="text-sm font-medium text-foreground">{activity.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(activity.date, { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{activity.description}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>

      {/* ── Slide-over panel: Testes a Fazer ── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-background border-l border-border z-50 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-primary" />
                    Testes a Fazer
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {loadingReports
                      ? "Carregando..."
                      : `${stats.qa_pending} planos · ${totalTestCases} casos de teste`}
                  </p>
                </div>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {loadingReports ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : testReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FlaskConical className="w-10 h-10 text-muted-foreground opacity-30 mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">Nenhum teste encontrado</p>
                    <p className="text-xs text-muted-foreground">Gere casos de teste na aba de QA.</p>
                  </div>
                ) : (
                  testReports.map((report) => {
                    const cases = report.result_json?.test_cases ?? [];
                    const isOpen = expandedReport === report.id;
                    return (
                      <div key={report.id} className="rounded-xl border border-border bg-surface overflow-hidden">
                        <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left group">
                          <button
                            onClick={() => setExpandedReport(isOpen ? null : report.id)}
                            className="flex-1 min-w-0 text-left outline-none"
                          >
                            <p className="text-sm font-medium text-foreground truncate">{report.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {cases.length} {cases.length === 1 ? "caso" : "casos"} ·{" "}
                              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ptBR })}
                            </p>
                          </button>
                          <div className="flex items-center shrink-0">
                            <button
                              onClick={(e) => deleteReport(report.id, e)}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                              title="Apagar testes"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setExpandedReport(isOpen ? null : report.id)}
                              className="p-2 text-muted-foreground hover:text-foreground rounded-md transition-colors ml-1"
                            >
                              <ChevronRight
                                className={cn(
                                  "w-4 h-4 transition-transform duration-200",
                                  isOpen && "rotate-90"
                                )}
                              />
                            </button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden border-t border-border"
                            >
                              {cases.length === 0 ? (
                                <p className="text-xs text-muted-foreground px-4 py-3">
                                  Sem casos de teste neste relatório.
                                </p>
                              ) : (
                                <ul className="divide-y divide-border">
                                  {cases.map((tc, idx) => {
                                    const CatIcon = CATEGORY_ICON[tc.category] ?? Clock;
                                    return (
                                      <li key={tc.id ?? idx} className="px-4 py-3 space-y-1.5">
                                        <div className="flex items-start gap-2">
                                          <CatIcon
                                            className={cn(
                                              "w-3.5 h-3.5 mt-0.5 shrink-0",
                                              CATEGORY_COLOR[tc.category] ?? "text-muted-foreground"
                                            )}
                                          />
                                          <p className="text-sm font-medium text-foreground leading-tight">
                                            {tc.title}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 pl-5">
                                          {tc.priority && (
                                            <span
                                              className={cn(
                                                "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase",
                                                PRIORITY_COLOR[String(tc.priority).toLowerCase()] ??
                                                  "text-muted-foreground bg-muted"
                                              )}
                                            >
                                              {tc.priority}
                                            </span>
                                          )}
                                          {Array.isArray(tc.steps) && tc.steps.length > 0 && (
                                            <span className="text-[10px] text-muted-foreground">
                                              {tc.steps.length} {tc.steps.length === 1 ? "passo" : "passos"}
                                            </span>
                                          )}
                                        </div>
                                        {tc.expected_result && (
                                          <p className="text-xs text-muted-foreground pl-5 leading-relaxed line-clamp-2">
                                            → {tc.expected_result}
                                          </p>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
