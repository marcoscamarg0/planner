"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FileText,
  BarChart2,
  CheckSquare,
  Sparkles,
  Loader2,
  Check,
  Clock,
  X,
  Download,
  Network,
  TestTube2,
  ListTree,
  FlaskConical,
  Table2,
  Zap,
} from "lucide-react";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { InsightBadge } from "@/components/dashboard/InsightBadge";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { TestFlowTab } from "@/components/projects/TestFlowTab";
import { QaResultsSpreadsheetTab } from "@/components/projects/QaResultsSpreadsheetTab";
import { QaClient } from "@/app/(app)/qa/QaClient";
import { createClient } from "@/lib/supabase/client";
import { extractTextFromTipTap, cn } from "@/lib/utils";
import type { Project, Page, Task, AiInsight } from "@/types";

interface ProjectEditorClientProps {
  project: Project;
  pages: Page[];
  tasks: Task[];
  insights: AiInsight[];
  initialPage: Page | null;
  currentUserId: string;
}

type Tab = "editor" | "tasks" | "flow" | "flow_spreadsheet" | "qa" | "smart_runner" | "batch_runner" | "test_cases" | "reports";

export function ProjectEditorClient({
  project,
  pages: initialPages,
  tasks: initialTasks,
  insights: initialInsights,
  initialPage,
  currentUserId,
}: ProjectEditorClientProps) {
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [insights, setInsights] = useState<AiInsight[]>(initialInsights);
  const [selectedPage, setSelectedPage] = useState<Page | null>(initialPage);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize the active tab from the URL ?tab= parameter
  const initialTab = (searchParams?.get("tab") as Tab) || "editor";
  const [tab, setTab] = useState<Tab>(["editor", "tasks", "flow", "flow_spreadsheet", "qa", "smart_runner", "batch_runner", "test_cases", "reports"].includes(initialTab) ? initialTab : "editor");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [suggestedTasks, setSuggestedTasks] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const aiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createPage = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("pages")
      .insert({
        project_id: project.id,
        title: "Nova página",
        content: null,
        order_index: pages.length,
      })
      .select()
      .single();

    if (data) {
      setPages((prev) => [...prev, data as Page]);
      setSelectedPage(data as Page);
    }
  };

  const deletePage = async (pageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza que deseja apagar esta página?")) return;

    const supabase = createClient();
    await supabase.from("pages").delete().eq("id", pageId);

    setPages(prev => prev.filter(p => p.id !== pageId));
    if (selectedPage?.id === pageId) {
      setSelectedPage(pages.find(p => p.id !== pageId) || null);
    }
  };

  const savePage = useCallback(
    async (content: Record<string, unknown>) => {
      if (!selectedPage) return;
      setSaveState("saving");

      const supabase = createClient();
      await supabase
        .from("pages")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", selectedPage.id);

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);

      if (aiDebounce.current) clearTimeout(aiDebounce.current);
      aiDebounce.current = setTimeout(async () => {
        const text = extractTextFromTipTap(content);
        if (text.length < 50) return;

        try {
          const res = await fetch("/api/ai/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageId: selectedPage.id,
              projectId: project.id,
              title: selectedPage.title,
              content: text,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.insight) {
              setInsights((prev) => [data.insight, ...prev.slice(0, 4)]);
            }
          }
        } catch { }
      }, 5000);
    },
    [selectedPage, project.id]
  );

  const updatePageTitle = async (
    pageId: string,
    title: string
  ) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title } : p))
    );
    const supabase = createClient();
    await supabase.from("pages").update({ title }).eq("id", pageId);
  };

  const fetchSuggestedTasks = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          projectTitle: project.title,
          projectDescription: project.description,
          existingTasks: tasks.map((t) => t.title),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestedTasks(data.suggestions ?? []);
      }
    } catch {
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const acceptSuggestedTask = async (title: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("tasks")
      .insert({
        project_id: project.id,
        title,
        status: "todo",
        priority: "medium",
      })
      .select()
      .single();

    if (data) {
      setTasks((prev) => [data as Task, ...prev]);
      setSuggestedTasks((prev) => prev.filter((t) => t !== title));
    }
  };

  const handleExportPDF = async () => {
    try {
      window.print();
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      alert("Não foi possível gerar o PDF. Verifique o console.");
    }
  };

  const latestInsight = insights[0];

  return (
    <div className="flex h-full bg-background overflow-hidden">
      <aside
        className="w-64 border-r border-border bg-surface/50 flex-col hidden lg:flex"
        aria-label="Navegação do projeto"
      >
        <div className="px-5 py-6 border-b border-border/50">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary shadow-sm border border-primary/20">
                <span className="text-lg">{project.emoji ?? "📁"}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate font-outfit">
                  {project.title}
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Workspace
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleExportPDF}
                className="flex-1 h-8 rounded-lg flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground bg-accent/50 hover:text-foreground hover:bg-accent transition-colors border border-transparent hover:border-border/50"
                title="Exportar Relatório em PDF"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </button>
              <button
                onClick={() => {
                  const newTitle = prompt("Novo nome do projeto:", project.title);
                  if (newTitle) {
                    const supabase = createClient();
                    supabase.from("projects").update({ title: newTitle }).eq("id", project.id).then(() => {
                      router.refresh();
                    });
                  }
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground bg-accent/50 hover:text-foreground hover:bg-accent transition-colors border border-transparent hover:border-border/50"
                title="Configurações"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={async () => {
                  if (confirm("Tem certeza que deseja apagar este projeto? Esta ação não pode ser desfeita.")) {
                    const supabase = createClient();
                    await supabase.from("projects").update({ status: "archived" }).eq("id", project.id);
                    router.push("/dashboard");
                  }
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 bg-rose-500/5 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
                title="Apagar Projeto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex items-center justify-between px-2 py-1.5 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Páginas
            </span>
            <button
              id="new-page-btn"
              onClick={createPage}
              aria-label="Nova página"
              className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            <AnimatePresence>
              {pages.map((page) => (
                <motion.div
                  key={page.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="group relative"
                >
                  <button
                    onClick={() => setSelectedPage(page)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left text-sm transition-all",
                      selectedPage?.id === page.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                    aria-current={selectedPage?.id === page.id ? "page" : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="w-4 h-4 shrink-0 opacity-70" aria-hidden="true" />
                      <span className="truncate">{page.title || "Sem título"}</span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => deletePage(page.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Apagar página"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {pages.length === 0 && (
              <button
                onClick={createPage}
                className="w-full text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg hover:border-primary/50 hover:text-primary transition-colors mt-2"
              >
                + Nova página
              </button>
            )}
          </div>
        </div>

        {latestInsight && (
          <div className="p-4 border-t border-border/50 bg-accent/30">
            <InsightBadge
              content={latestInsight.content}
              type={latestInsight.type}
              compact
            />
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="border-b border-border/50 bg-surface/50 px-6 pt-3 flex items-end gap-6 overflow-x-auto no-scrollbar relative z-10">
          <div className="flex items-center gap-6">
            <button
              id="tab-editor"
              onClick={() => setTab("editor")}
              className={cn(
                "flex items-center gap-2 pb-3 text-[13px] font-medium transition-all relative",
                tab === "editor"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === "editor"}
            >
              <FileText className="w-4 h-4" />
              Editor
              {tab === "editor" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button
              id="tab-tasks"
              onClick={() => setTab("tasks")}
              className={cn(
                "flex items-center gap-2 pb-3 text-[13px] font-medium transition-all relative",
                tab === "tasks"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === "tasks"}
            >
              <CheckSquare className="w-4 h-4" />
              Tarefas
              {tasks.filter((t) => t.status !== "done").length > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === "tasks" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tasks.filter((t) => t.status !== "done").length}
                </span>
              )}
              {tab === "tasks" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button
              id="tab-flow"
              onClick={() => setTab("flow")}
              className={cn(
                "flex items-center gap-2 pb-3 text-[13px] font-medium transition-all relative",
                tab === "flow"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === "flow"}
            >
              <Network className="w-4 h-4" />
              Fluxo
              {tab === "flow" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button
              id="tab-flow-spreadsheet"
              onClick={() => setTab("flow_spreadsheet")}
              className={cn(
                "flex items-center gap-2 pb-3 text-[13px] font-medium transition-all relative",
                tab === "flow_spreadsheet"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === "flow_spreadsheet"}
            >
              <Table2 className="w-4 h-4" />
              Planilha
              {tab === "flow_spreadsheet" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button
              id="tab-smart_runner"
              onClick={() => setTab("smart_runner")}
              className={cn(
                "flex items-center gap-2 pb-3 text-[13px] font-medium transition-all relative",
                tab === "smart_runner"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === "smart_runner"}
            >
              <Zap className="w-4 h-4" />
              Runner IA
              {tab === "smart_runner" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button
              id="tab-batch_runner"
              onClick={() => setTab("batch_runner")}
              className={cn(
                "flex items-center gap-2 pb-3 text-[13px] font-medium transition-all relative",
                tab === "batch_runner"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === "batch_runner"}
            >
              <ListTree className="w-4 h-4" />
              Lote / Fila
              {tab === "batch_runner" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button
              id="tab-test_cases"
              onClick={() => setTab("test_cases")}
              className={cn(
                "flex items-center gap-2 pb-3 text-[13px] font-medium transition-all relative",
                tab === "test_cases"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === "test_cases"}
            >
              <FlaskConical className="w-4 h-4" />
              Casos de Teste
              {tab === "test_cases" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button
              id="tab-reports"
              onClick={() => setTab("reports")}
              className={cn(
                "flex items-center gap-2 pb-3 text-[13px] font-medium transition-all relative",
                tab === "reports"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === "reports"}
            >
              <FileText className="w-4 h-4" />
              Relatórios QA
              {tab === "reports" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
              )}
            </button>
            <button
              id="tab-report"
              onClick={() => router.push(`/projects/${project.id}/report`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Relatório
            </button>
          </div>

          <div className="flex items-center gap-2 pb-3">
            <AnimatePresence>
              {saveState === "saving" && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Salvando...
                </motion.span>
              )}
              {saveState === "saved" && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-emerald-400"
                >
                  <Check className="w-3 h-3" />
                  Salvo
                </motion.span>
              )}
            </AnimatePresence>

            <button
              id="suggest-tasks-btn"
              onClick={fetchSuggestedTasks}
              disabled={loadingSuggestions}
              aria-label="Sugerir tarefas com IA"
              title="Sugerir tarefas com IA"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-50"
            >
              {loadingSuggestions ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              IA
            </button>
          </div>
        </div>

        {suggestedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border bg-amber-500/5 px-4 py-3"
          >
            <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Tarefas sugeridas pela IA
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedTasks.map((task) => (
                <button
                  key={task}
                  onClick={() => acceptSuggestedTask(task)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 hover:bg-amber-500/20 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  {task}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="flex-1 overflow-hidden">
          {tab === "editor" && (
            <>
              {selectedPage ? (
                <div className="flex flex-col h-full">
                  <div className="px-4 sm:px-8 lg:px-16 pt-6">
                    <input
                      type="text"
                      value={selectedPage.title}
                      onChange={(e) =>
                        setSelectedPage((p) =>
                          p ? { ...p, title: e.target.value } : p
                        )
                      }
                      onBlur={(e) =>
                        updatePageTitle(selectedPage.id, e.target.value)
                      }
                      placeholder="Sem título"
                      aria-label="Título da página"
                      className="w-full max-w-3xl mx-auto block text-3xl font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40 mb-4"
                    />
                  </div>
                  <BlockEditor
                    key={selectedPage.id}
                    content={selectedPage.content}
                    onSave={savePage}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div>
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm mb-4">
                      Nenhuma página selecionada
                    </p>
                    <button
                      onClick={createPage}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      Criar primeira página
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "tasks" && (
            <TaskPanel
              tasks={tasks}
              projectId={project.id}
              projectUrl={project.target_url || undefined}
              onTasksChange={setTasks}
            />
          )}

          {tab === "flow" && (
            <TestFlowTab
              projectId={project.id}
              initialFlowData={project.flow_data}
            />
          )}

          {tab === "flow_spreadsheet" && (
            <QaResultsSpreadsheetTab
              projectId={project.id}
              targetUrl={project.target_url}
            />
          )}

          {["smart_runner", "batch_runner", "test_cases", "reports"].includes(tab) && (
            <QaClient projectId={project.id} externalTab={tab as any} projectUrl={project.target_url || undefined} />
          )}
        </div>
      </div>
    </div>
  );
}
