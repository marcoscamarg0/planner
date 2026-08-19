"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  RefreshCw,
  Sparkles,
  Layers,
  ArrowUpRight,
  Check,
  Circle,
  FileText,
  TrendingUp,
  CornerDownRight,
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
  type: "project_updated" | "task_completed" | "task_created";
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
  alta: "text-rose-400 bg-rose-400/10 border border-rose-400/20",
  media: "text-amber-400 bg-amber-400/10 border border-amber-400/20",
  média: "text-amber-400 bg-amber-400/10 border border-amber-400/20",
  baixa: "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20",
  high: "text-rose-400 bg-rose-400/10 border border-rose-400/20",
  medium: "text-amber-400 bg-amber-400/10 border border-amber-400/20",
  low: "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20",
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  happy_path: CheckCircle2,
  error: AlertCircle,
  edge_case: TriangleAlert,
};

const CATEGORY_COLOR: Record<string, string> = {
  happy_path: "text-emerald-400",
  error: "text-rose-400",
  edge_case: "text-amber-400",
};

export function DashboardClient({
  profile,
  projectsWithStats: initialProjects,
  allTasks: initialTasks,
  stats: initialStats,
}: DashboardClientProps) {
  const router = useRouter();
  const [dashboardInsight, setDashboardInsight] = useState<string | null>(null);

  // ── Live state ──────────────────────────────
  const [tasks, setTasks] = useState<Task[]>(initialTasks ?? []);
  const [projects, setProjects] = useState<ProjectWithStats[]>(initialProjects ?? []);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tasksTab, setTasksTab] = useState<"pending" | "done" | "all">("pending");
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // ── Test panel state ────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [testReports, setTestReports] = useState<QaReport[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const supabaseRef = useRef(createClient());

  const flash = useCallback(() => {
    setLiveIndicator(true);
    setTimeout(() => setLiveIndicator(false), 800);
  }, []);

  // ── Manual & background data fetcher ────────
  const refreshDashboardData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        if (data.allTasks) setTasks(data.allTasks);
        if (data.projectsWithStats) setProjects(data.projectsWithStats);
        flash();
      }
    } catch (err) {
      console.warn("[Dashboard] Refresh failed:", err);
    } finally {
      if (showSpinner) setIsRefreshing(false);
    }
  }, [flash]);

  // ── Polling & Auto-Refresh totalmente automático em tempo real ──
  useEffect(() => {
    // 1. Polling a cada 15 segundos (apenas se a aba estiver ativa)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshDashboardData(false);
      }
    }, 15000);

    // 2. Atualização imediata ao focar na janela ou mudar de aba
    const handleFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        refreshDashboardData(false);
      }
    };

    // 3. Atualização instantânea ao marcar tarefas em outra aba
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "planner_tasks_updated" || !e.key) {
        refreshDashboardData(false);
      }
    };

    window.addEventListener("focus", handleFocusOrVisible);
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisible);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshDashboardData]);

  // ── AI Insight (once on mount) ──────────────
  useEffect(() => {
    if (initialProjects.length === 0) return;
    const run = async () => {
      try {
        const activeTasks = tasks.filter((t) => t.status !== "cancelled");
        const res = await fetch("/api/ai/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectTitle: "todos os projetos",
            stats: {
              total_tasks: activeTasks.length,
              completed_tasks: activeTasks.filter((t) => t.status === "done").length,
              pages_count: initialProjects.reduce((a, p) => a + (p.pages_count || 0), 0),
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

  // ── Toggle task status directly from Dashboard ─
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus: Task["status"] = currentStatus === "done" ? "todo" : "done";
    setTogglingTaskId(taskId);

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus, updated_at: new Date().toISOString() } : t))
    );
    flash();

    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: nextStatus }),
      });
      if (!res.ok) {
        throw new Error("Erro ao atualizar status");
      }
    } catch (err: any) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: currentStatus as Task["status"] } : t))
      );
      alert("Não foi possível atualizar a tarefa: " + err.message);
    } finally {
      setTogglingTaskId(null);
    }
  };

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

  const deleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja apagar este plano de teste?")) return;
    setTestReports((prev) => prev.filter((r) => r.id !== reportId));
    try {
      await supabaseRef.current.from("qa_reports").delete().eq("id", reportId);
    } catch {}
  };

  // ── Derived dynamic statistics & progress ──
  const validTasks = useMemo(
    () => tasks.filter((t) => t.status !== "cancelled" && t.title?.trim() !== ""),
    [tasks]
  );

  const totalTasksCount = validTasks.length;
  const completedTasksCount = validTasks.filter((t) => t.status === "done").length;
  const pendingTasksCount = validTasks.filter((t) => t.status !== "done").length;
  const globalCompletionRate =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  const totalTestCases = testReports.reduce(
    (sum, r) => sum + (r.result_json?.test_cases?.length ?? 0),
    0
  );

  // Projects with dynamically recomputed stats from live tasks state
  const computedProjects = useMemo(() => {
    return projects.map((p) => {
      const subIds = projects.filter((sub) => sub.parent_id === p.id).map((sub) => sub.id);
      const targetIds = [p.id, ...subIds];
      const pTasks = validTasks.filter((t) => targetIds.includes(t.project_id));
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.status === "done").length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...p,
        total_tasks: total,
        completed_tasks: completed,
        completion_rate: rate,
      };
    });
  }, [projects, validTasks]);

  const isSubproject = (p: ProjectWithStats, all: ProjectWithStats[]) => {
    if (!p.parent_id) return false;
    if (p.parent_id === "null" || p.parent_id === "undefined" || p.parent_id === "" || p.parent_id === "none") return false;
    return all.some((other) => other.id === p.parent_id);
  };

  // Apenas projetos principais aparecem no grid superior
  const rootProjects = useMemo(() => {
    return computedProjects.filter((p) => !isSubproject(p, computedProjects));
  }, [computedProjects]);

  // Filtered tasks list for the tasks card
  const filteredTasks = useMemo(() => {
    if (tasksTab === "pending") return validTasks.filter((t) => t.status !== "done");
    if (tasksTab === "done") return validTasks.filter((t) => t.status === "done");
    return validTasks;
  }, [validTasks, tasksTab]);

  // Project lookup map
  const projectMap = useMemo(() => {
    const map = new Map<string, ProjectWithStats>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  // ── Build activity feed ──
  const activities = useMemo(() => {
    const parseDateSafe = (d?: string | Date | null) => {
      if (!d) return new Date();
      const p = new Date(d);
      return isNaN(p.getTime()) ? new Date() : p;
    };

    const feed: ActivityItem[] = [];

    projects.slice(0, 5).forEach((p) =>
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

    tasks
      .filter((t) => t.status === "done" && t.title)
      .slice(0, 8)
      .forEach((t) =>
        feed.push({
          id: `t-${t.id}`,
          type: "task_completed",
          title: t.title,
          description: "Tarefa concluída",
          date: parseDateSafe(t.updated_at),
          icon: CheckSquare,
          color: "text-emerald-500 bg-emerald-500/10",
        })
      );

    feed.sort((a, b) => b.date.getTime() - a.date.getTime());
    return feed.slice(0, 12);
  }, [tasks, projects]);

  const [userName, setUserName] = useState(profile?.full_name ?? "");

  useEffect(() => {
    // Se o nome for o padrão ou contiver Administrador, busca o perfil real em /api/auth/me
    if (!userName || userName.toLowerCase().includes("administrador") || userName === "Usuário") {
      fetch("/api/auth/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.user_metadata?.full_name) {
            setUserName(data.user.user_metadata.full_name);
          }
        })
        .catch(() => {});
    }
  }, [userName]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };
  const firstName = userName ? userName.split(" ")[0] : "Marcos";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* ── Header ── */}
      <header className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
              {greeting()}, {firstName}.
            </h1>
            <p className="text-muted-foreground text-sm">
              Visão geral dos seus projetos, progresso e entregas em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh button */}
            <button
              onClick={() => refreshDashboardData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
              title="Atualizar dados agora"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-primary")} />
              <span>{isRefreshing ? "Atualizando..." : "Atualizar"}</span>
            </button>

            {/* Live indicator */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-accent/40 px-2.5 py-1 rounded-full border border-border/50">
              <span
                className={cn(
                  "w-2 h-2 rounded-full transition-colors duration-300",
                  liveIndicator
                    ? "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)] animate-pulse"
                    : "bg-emerald-500"
                )}
              />
              <span className="font-medium">Tempo Real</span>
            </div>
          </div>
        </div>

        {dashboardInsight && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-2"
          >
            <InsightBadge content={dashboardInsight} type="progress" compact />
          </motion.div>
        )}
      </header>

      {/* ── Stat Cards ── */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Projetos Ativos */}
          <Link
            href="/projects"
            className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/40 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Projetos Ativos</span>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FolderKanban className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-foreground font-heading">
                {projects.filter((p) => p.status === "active").length}
              </span>
              <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                Ver todos <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>

          {/* Tarefas Pendentes */}
          <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-border/80 bg-card hover:border-amber-500/40 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Tarefas Pendentes</span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4">
              <motion.span
                key={pendingTasksCount}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                className="text-2xl sm:text-3xl font-extrabold text-foreground font-heading inline-block"
              >
                {pendingTasksCount}
              </motion.span>
            </div>
          </div>

          {/* Progresso Global */}
          <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-border/80 bg-card hover:border-emerald-500/40 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Progresso Global</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-heading">
                  {globalCompletionRate}%
                </span>
                <span className="text-[11px] text-muted-foreground font-semibold">
                  {completedTasksCount}/{totalTasksCount} concluídas
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${globalCompletionRate}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Progresso dos Projetos (PROJECTS SECTION) ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Progresso dos Projetos ({rootProjects.length})
            </h2>
          </div>
          <Link
            href="/projects"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            Gerenciar Projetos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {rootProjects.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-border text-center space-y-3 bg-card/40">
            <FolderKanban className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-foreground">Nenhum projeto encontrado</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Crie seu primeiro projeto para acompanhar o progresso e as entregas aqui.
            </p>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              Criar Projeto
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rootProjects.map((p) => {
              const subProjects = computedProjects.filter((sp) => sp.parent_id === p.id);
              const allIds = [p.id, ...subProjects.map((sp) => sp.id)];
              const allPTasks = validTasks.filter((t) => allIds.includes(t.project_id));
              const total = allPTasks.length;
              const completed = allPTasks.filter((t) => t.status === "done").length;
              const rate = p.status === "completed" ? 100 : (total > 0 ? Math.round((completed / total) * 100) : 0);

              return (
                <div
                  key={p.id}
                  className="group block p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Link href={`/projects/${p.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm"
                        style={{ backgroundColor: `${p.color || "#6366f1"}20`, border: `1px solid ${p.color || "#6366f1"}40` }}
                      >
                        {p.emoji || "📁"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {p.title}
                        </h3>
                        <span className="text-[11px] text-muted-foreground">
                          {p.status === "active" ? "🟢 Ativo" : p.status === "completed" ? "✅ Concluído" : "🟡 Planejamento"}
                        </span>
                      </div>
                    </Link>
                    <Link href={`/projects/${p.id}`}>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  </div>

                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                      {p.description}
                    </p>
                  )}

                  {/* Progress bar */}
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-muted-foreground">Progresso Geral</span>
                      <span className="font-bold text-foreground">{rate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${rate}%`,
                          backgroundColor: p.color || "#6366f1",
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                      <span>
                        <strong>{completed}</strong> de <strong>{total}</strong> tarefas
                      </span>
                      {p.pages_count !== undefined && p.pages_count > 0 && (
                        <span>{p.pages_count} docs</span>
                      )}
                    </div>
                  </div>

                  {/* Subprojetos Aninhados */}
                  {subProjects.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        <span className="flex items-center gap-1 text-primary">
                          <CornerDownRight className="w-3 h-3" /> Subprojetos ({subProjects.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {subProjects.map((sp) => {
                          const spTasks = validTasks.filter((t) => t.project_id === sp.id);
                          const spTotal = spTasks.length;
                          const spCompleted = spTasks.filter((t) => t.status === "done").length;
                          const spRate = sp.status === "completed"
                            ? 100
                            : (spTotal > 0 ? Math.round((spCompleted / spTotal) * 100) : 0);

                          return (
                            <Link
                              key={sp.id}
                              href={`/projects/${sp.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-2 rounded-xl bg-accent/40 hover:bg-accent/80 transition-colors border border-border/40 group/sub"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-xs">{sp.emoji || "📁"}</span>
                                <span className="text-xs font-semibold text-foreground truncate group-hover/sub:text-primary transition-colors">
                                  {sp.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {spCompleted}/{spTotal}
                                </span>
                                <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${spRate}%`,
                                      backgroundColor: sp.color || "#6366f1",
                                    }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-foreground w-6 text-right">
                                  {spRate}%
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Grid: Minhas Tarefas + Activity Feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Minhas Tarefas (2 cols) */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Tarefas & Execução
              </h2>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 text-xs">
              <button
                onClick={() => setTasksTab("pending")}
                className={cn(
                  "px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                  tasksTab === "pending"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Pendentes ({pendingTasksCount})
              </button>
              <button
                onClick={() => setTasksTab("done")}
                className={cn(
                  "px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                  tasksTab === "done"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Concluídas ({completedTasksCount})
              </button>
              <button
                onClick={() => setTasksTab("all")}
                className={cn(
                  "px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer",
                  tasksTab === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todas ({totalTasksCount})
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden divide-y divide-border/50 shadow-sm">
            {filteredTasks.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-foreground">
                  {tasksTab === "pending" ? "Tudo em dia! Nenhuma tarefa pendente." : "Nenhuma tarefa nesta categoria."}
                </p>
                <p className="text-xs text-muted-foreground">
                  Crie novas tarefas diretamente nos seus projetos ou na aba de QA.
                </p>
              </div>
            ) : (
              filteredTasks.slice(0, 50).map((t) => {
                const isDone = t.status === "done";
                const isToggling = togglingTaskId === t.id;
                const proj = projectMap.get(t.project_id);

                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center justify-between p-3.5 sm:p-4 hover:bg-accent/30 transition-colors gap-3 group",
                      isDone && "bg-muted/10 opacity-75"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Checkbox button */}
                      <button
                        onClick={() => handleToggleTaskStatus(t.id, t.status)}
                        disabled={isToggling}
                        className={cn(
                          "w-5 h-5 rounded-lg border flex items-center justify-center transition-all mt-0.5 shrink-0 cursor-pointer",
                          isDone
                            ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                            : "border-border hover:border-primary text-transparent hover:text-primary/30"
                        )}
                        title={isDone ? "Marcar como pendente" : "Marcar como concluída"}
                      >
                        {isToggling ? (
                          <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        ) : isDone ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <Check className="w-3 h-3 opacity-0 group-hover:opacity-40" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium text-foreground leading-snug transition-all",
                            isDone && "line-through text-muted-foreground"
                          )}
                        >
                          {t.title}
                        </p>

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {proj && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border"
                              style={{
                                backgroundColor: `${proj.color || "#6366f1"}15`,
                                borderColor: `${proj.color || "#6366f1"}30`,
                                color: proj.color || "#6366f1",
                              }}
                            >
                              <span>{proj.emoji || "📁"}</span>
                              <span className="truncate max-w-[120px]">{proj.title}</span>
                            </span>
                          )}

                          {t.priority && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase",
                                PRIORITY_COLOR[String(t.priority).toLowerCase()] || PRIORITY_COLOR["medium"]
                              )}
                            >
                              {t.priority}
                            </span>
                          )}

                          {t.due_date && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(t.due_date).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {proj && (
                      <Link
                        href={`/projects/${proj.id}`}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all shrink-0"
                        title="Ir para o projeto"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Feed de Atividade (1 col) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              Feed de Atividades
            </h2>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
            {activities.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Sem atividades recentes.
              </div>
            ) : (
              <div className="relative border-l border-border ml-2 space-y-5 pb-2">
                <AnimatePresence initial={false}>
                  {activities.map((activity, i) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      className="relative pl-5"
                    >
                      <div
                        className={cn(
                          "absolute -left-3 top-0 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center",
                          activity.color
                        )}
                      >
                        <activity.icon className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground line-clamp-1">{activity.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{activity.description}</p>
                        <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                          {formatDistanceToNow(activity.date, { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      </div>

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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
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
                      : `${initialStats.qa_pending} planos · ${totalTestCases} casos de teste`}
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
