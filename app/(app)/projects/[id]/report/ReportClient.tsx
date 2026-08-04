"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckSquare, FileText, TrendingUp, TestTube2, CheckCircle2, ShieldAlert } from "lucide-react";
import { ProgressChart } from "@/components/dashboard/ProgressChart";
import { InsightBadge } from "@/components/dashboard/InsightBadge";
import { getProgressColor, getStatusLabel, formatRelativeDate } from "@/lib/utils";
import type { Project, Task, AiInsight, Page } from "@/types";

interface ReportClientProps {
  project: Project;
  tasks: Task[];
  insights: AiInsight[];
  pages: Pick<Page, "id" | "title" | "created_at" | "updated_at">[];
  qaReports?: any[];
}

export function ReportClient({ project, tasks, insights, pages, qaReports = [] }: ReportClientProps) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const progressRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const progressColor = getProgressColor(progressRate);

  const priorityCount = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.priority] = (acc[t.priority] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao projeto
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-3xl">{project.emoji ?? "📁"}</span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
            <p className="text-sm text-muted-foreground">
              Relatório de progresso · {getStatusLabel(project.status)}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        aria-label="Resumo do projeto"
      >
        <div className="glass rounded-2xl p-6 gradient-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Progresso geral
            </h2>
            <span className="text-2xl font-bold" style={{ color: progressColor }}>
              {progressRate}%
            </span>
          </div>
          <div
            className="h-3 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={progressRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso do projeto: ${progressRate}%`}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: progressColor }}
              initial={{ width: 0 }}
              animate={{ width: `${progressRate}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total", value: totalTasks, color: "#6366f1" },
              { label: "Em progresso", value: inProgressTasks, color: "#f97316" },
              { label: "Concluídas", value: completedTasks, color: "#10b981" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p
                  className="text-xl font-bold"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        aria-label="Gráficos de tarefas"
      >
        <ProgressChart tasks={tasks} />
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        aria-label="Prioridades"
      >
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Distribuição por prioridade
          </h2>
          <div className="space-y-3">
            {(["urgent", "high", "medium", "low"] as const).map((p) => {
              const count = priorityCount[p] ?? 0;
              const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
              const colors: Record<string, string> = {
                urgent: "#ef4444",
                high: "#f97316",
                medium: "#6366f1",
                low: "#10b981",
              };
              const labels: Record<string, string> = {
                urgent: "Urgente",
                high: "Alta",
                medium: "Média",
                low: "Baixa",
              };

              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-14">
                    {labels[p]}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: colors[p] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-6 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {insights.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          aria-label="Insights gerados por IA"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Insights do projeto
          </h2>
          <div className="space-y-3">
            {insights.map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <InsightBadge content={insight.content} type={insight.type} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {pages.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          aria-label="Páginas do projeto"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Páginas ({pages.length})
          </h2>
          <div className="glass rounded-2xl overflow-hidden">
            <ul>
              {pages.map((page, i) => (
                <li
                  key={page.id}
                  className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0"
                >
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-sm text-foreground hover:text-primary transition-colors font-medium"
                  >
                    {page.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    Atualizado {formatRelativeDate(page.updated_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>
      )}

      {qaReports && qaReports.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          aria-label="Relatórios de Qualidade"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TestTube2 className="w-4 h-4 text-primary" />
            Qualidade & Testes ({qaReports.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {qaReports.map((rep) => {
              const isTestCase = rep.type === "test_cases";
              const isBug = rep.type === "bug_report";
              return (
                <div key={rep.id} className="glass p-4 rounded-xl space-y-2 border border-border/50">
                  <div className="flex items-start justify-between">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider ${
                      isTestCase ? 'bg-sky-500/10 text-sky-400' : 
                      isBug ? 'bg-rose-500/10 text-rose-400' : 'bg-primary/10 text-primary'
                    }`}>
                      {rep.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatRelativeDate(rep.created_at)}</span>
                  </div>
                  <h3 className="font-medium text-sm line-clamp-1">{rep.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    {rep.model_used && (
                      <span className="bg-accent px-2 py-0.5 rounded-full">{rep.model_used}</span>
                    )}
                    {rep.result_json?.test_cases && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {rep.result_json.test_cases.length} casos
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </div>
  );
}
