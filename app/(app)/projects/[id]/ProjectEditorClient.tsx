"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { InsightBadge } from "@/components/dashboard/InsightBadge";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { createClient } from "@/lib/supabase/client";
import { extractTextFromTipTap, cn } from "@/lib/utils";
import type { Project, Page, Task, AiInsight } from "@/types";

interface ProjectEditorClientProps {
  project: Project;
  pages: Page[];
  tasks: Task[];
  insights: AiInsight[];
  initialPage: Page | null;
}

type Tab = "editor" | "tasks";

export function ProjectEditorClient({
  project,
  pages: initialPages,
  tasks: initialTasks,
  insights: initialInsights,
  initialPage,
}: ProjectEditorClientProps) {
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [insights, setInsights] = useState<AiInsight[]>(initialInsights);
  const [selectedPage, setSelectedPage] = useState<Page | null>(initialPage);
  const [tab, setTab] = useState<Tab>("editor");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [suggestedTasks, setSuggestedTasks] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const aiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();

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
        } catch {}
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
      const element = document.getElementById("pdf-export-area");
      if (!element) return;
      
      // Dynamic import to avoid SSR issues
      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;
      
      const opt = {
        margin: 10,
        filename: `${project.title || 'relatorio'}-dashboard.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      alert("Não foi possível gerar o PDF. Verifique o console.");
    }
  };

  const latestInsight = insights[0];

  return (
    <div className="flex h-full">
      <aside
        className="w-56 border-r border-border bg-card/50 flex flex-col hidden lg:flex"
        aria-label="Páginas do projeto"
      >
        <div className="px-4 py-3 border-b border-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-lg shrink-0">{project.emoji ?? "📁"}</span>
              <h2 className="text-sm font-semibold text-foreground truncate">
                {project.title}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleExportPDF}
                className="w-6 h-6 rounded flex items-center justify-center text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                title="Exportar Relatório em PDF"
              >
                <Download className="w-3.5 h-3.5" />
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
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Renomear Projeto"
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
                className="w-6 h-6 rounded flex items-center justify-center text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Apagar Projeto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-xs text-muted-foreground font-medium">Páginas</span>
            <button
              id="new-page-btn"
              onClick={createPage}
              aria-label="Nova página"
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <AnimatePresence>
            {pages.map((page) => (
              <motion.button
                key={page.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onClick={() => setSelectedPage(page)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-xs transition-all",
                  selectedPage?.id === page.id
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                aria-current={selectedPage?.id === page.id ? "page" : undefined}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{page.title}</span>
              </motion.button>
            ))}
          </AnimatePresence>

          {pages.length === 0 && (
            <button
              onClick={createPage}
              className="w-full text-center py-8 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Nova página
            </button>
          )}
        </div>

        {latestInsight && (
          <div className="p-3 border-t border-border">
            <InsightBadge
              content={latestInsight.content}
              type={latestInsight.type}
              compact
            />
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-border bg-card/80 px-4 flex items-center justify-between h-12 gap-4">
          <div className="flex items-center gap-1">
            <button
              id="tab-editor"
              onClick={() => setTab("editor")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "editor"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              aria-pressed={tab === "editor"}
            >
              <FileText className="w-3.5 h-3.5" />
              Editor
            </button>
            <button
              id="tab-tasks"
              onClick={() => setTab("tasks")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === "tasks"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              aria-pressed={tab === "tasks"}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Tarefas
              {tasks.filter((t) => t.status !== "done").length > 0 && (
                <span className="bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                  {tasks.filter((t) => t.status !== "done").length}
                </span>
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

          <div className="flex items-center gap-2">
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
              onTasksChange={setTasks}
            />
          )}
        </div>
      </div>
    </div>
  );
}
