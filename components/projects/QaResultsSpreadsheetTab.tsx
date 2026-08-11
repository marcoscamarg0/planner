"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Download, Table2, CheckCircle2, AlertCircle, FileText, Calendar, Sparkles, Edit2, Check, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QaResultsSpreadsheetTabProps {
  projectId: string;
  targetUrl?: string | null;
}

interface QaReport {
  id: string;
  type: string;
  title: string;
  result_raw: string;
  result_json: any;
  created_at: string;
}

export function QaResultsSpreadsheetTab({ projectId, targetUrl }: QaResultsSpreadsheetTabProps) {
  const [reports, setReports] = useState<QaReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingSummaryFor, setGeneratingSummaryFor] = useState<string | null>(null);
  const [editingSummaryFor, setEditingSummaryFor] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("qa_reports")
        .select("id, type, title, result_raw, result_json, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (data) {
        setReports(data);
      }
      setLoading(false);
    };

    fetchReports();
  }, [projectId]);

  const cleanTitle = (title: string) => {
    if (!title) return "";
    let t = title.replace(/["'`]/g, "").trim();
    
    // Remove prefixos automáticos gerados pelo runner e pela IA
    t = t.replace(/^Automação\s+.*?\s+—\s+Título da Tarefa:\s*/i, "");
    t = t.replace(/^Automação\s+.*?\s+—\s*/i, "");
    t = t.replace(/^Auditoria IA\s+\(Rodando\):\s+Título da Tarefa:\s*/i, "");
    t = t.replace(/^Auditoria IA\s+\(Rodando\):\s*/i, "");
    t = t.replace(/^Título da Tarefa:\s*/i, "");
    
    return t;
  };

  const sortedReports = [...reports].sort((a, b) => {
    return cleanTitle(a.title).localeCompare(cleanTitle(b.title), undefined, { numeric: true });
  });

  const getSummary = (report: QaReport) => {
    if (report.result_json?.summary) {
      return report.result_json.summary.replace(/["'`]/g, "");
    }
    if (report.type === "automation") {
      return "Script de automação gerado com sucesso.";
    }
    let raw = (report.result_raw || "").replace(/```typescript/g, "").replace(/```/g, "").replace(/["'`]/g, "").trim();
    return raw;
  };

  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 });

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar este relatório?")) return;
    
    setReports(prev => prev.filter(r => r.id !== id));
    
    const supabase = createClient();
    await supabase.from("qa_reports").delete().eq("id", id);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedReports.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Tem certeza que deseja apagar ${selectedIds.size} relatórios selecionados?`)) return;
    
    setIsDeletingBulk(true);
    const idsToDelete = Array.from(selectedIds);
    
    // Optimistic update
    setReports(prev => prev.filter(r => !idsToDelete.includes(r.id)));
    setSelectedIds(new Set());
    
    const supabase = createClient();
    await supabase.from("qa_reports").delete().in("id", idsToDelete);
    setIsDeletingBulk(false);
  };

  const handleEditStart = (report: QaReport) => {
    setEditingSummaryFor(report.id);
    setEditedSummary(getSummary(report));
  };

  const handleEditSave = async (report: QaReport) => {
    const newJson = { ...(report.result_json || {}), summary: editedSummary };
    const supabase = createClient();
    await supabase.from("qa_reports").update({ result_json: newJson }).eq("id", report.id);
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, result_json: newJson } : r));
    setEditingSummaryFor(null);
  };

  const handleGenerateSummary = async (report: QaReport) => {
    setGeneratingSummaryFor(report.id);
    try {
      const res = await fetch("/api/ai/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_type: "summarize_report",
          input: report.result_raw || "",
          model: "auto-free",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          const newJson = { ...(report.result_json || {}), summary: data.summary };
          
          const supabase = createClient();
          await supabase.from("qa_reports").update({ result_json: newJson }).eq("id", report.id);

          setReports(prev => prev.map(r => r.id === report.id ? { ...r, result_json: newJson } : r));
        }
      } else {
        const errData = await res.json();
        if (errData.error && errData.error.includes("429")) {
           alert("Limite diário de requisições gratuitas da IA atingido! Aguarde algumas horas ou tente novamente amanhã.");
        }
      }
    } catch (e) {
      console.error(e);
    }
    setGeneratingSummaryFor(null);
  };

  const handleGenerateAllSummaries = async () => {
    const toGenerate = reports.filter(r => !r.result_json?.summary);
    if (toGenerate.length === 0) return;
    
    setGeneratingAll(true);
    let count = 0;
    
    for (const report of toGenerate) {
      setGenerateProgress({ current: count + 1, total: toGenerate.length });
      
      // Pausa inteligente de 4 segundos entre requisições para evitar erro 429 de Rate Limit (OpenRouter/Groq)
      if (count > 0) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }

      try {
        const res = await fetch("/api/ai/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool_type: "summarize_report",
            input: report.result_raw || "",
            model: "auto-free",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.summary) {
            const newJson = { ...(report.result_json || {}), summary: data.summary };
            const supabase = createClient();
            await supabase.from("qa_reports").update({ result_json: newJson }).eq("id", report.id);
            setReports(prev => prev.map(r => r.id === report.id ? { ...r, result_json: newJson } : r));
          }
        } else {
          const errData = await res.json();
          if (errData.error && errData.error.includes("429")) {
             alert("Limite diário de requisições gratuitas da IA atingido! Aguarde algumas horas ou até amanhã para gerar mais resumos em massa.");
             setGeneratingAll(false);
             return;
          }
          console.error("Erro na API:", errData);
          break; // Stop the loop on API error so we don't spam
        }
      } catch (e) {
        console.error(e);
        break; // Stop the loop on network error
      }
      count++;
    }
    
    setGeneratingAll(false);
  };

  // Helper to guess status from raw text if not explicitly available
  const getStatusInfo = (report: QaReport) => {
    if (report.type === "automation") {
      return { label: "Passou", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    }

    if (report.result_json?.status === "passed" || report.result_json?.success === true) {
      return { label: "Passou", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    }
    if (report.result_json?.status === "failed" || report.result_json?.success === false) {
      return { label: "Falhou", color: "text-rose-400", bg: "bg-rose-500/15 border-rose-500/30", icon: <AlertCircle className="w-3.5 h-3.5" /> };
    }

    const raw = (report.result_raw || "").toLowerCase();
    
    if (raw.includes("falha") || raw.includes("erro") || raw.includes("failed") || raw.includes("bug")) {
      return { label: "Falhou", color: "text-rose-400", bg: "bg-rose-500/15 border-rose-500/30", icon: <AlertCircle className="w-3.5 h-3.5" /> };
    }
    if (raw.includes("sucesso") || raw.includes("passou") || raw.includes("passed") || raw.includes("aprovado") || raw.includes("ok")) {
      return { label: "Passou", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    }
    return { label: "Info/Aviso", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", icon: <FileText className="w-3.5 h-3.5" /> };
  };

  const handleExportCSV = () => {
    const header = "Data;Tipo de Teste;Link Testado;Título;Status;Resumo\n";
    const rows = sortedReports.map((report) => {
      const date = new Date(report.created_at).toLocaleString("pt-BR");
      const status = getStatusInfo(report).label;
      const title = cleanTitle(report.title);
      let summary = getSummary(report).replace(/\n/g, ' ');
      summary = summary.substring(0, 300) + (summary.length > 300 ? "..." : "");
      
      return `"${date}";"${report.type}";"${targetUrl || ""}";"${title}";"${status}";"${summary}"`;
    }).join("\n");

    const csv = header + rows;
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `QA_Resultados_${projectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background/50">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-background/50 p-8">
        <Table2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-foreground font-medium mb-1">Nenhum teste encontrado</p>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Você ainda não executou nenhum teste de QA neste projeto. 
          Use o "Runner IA" ou os "Casos de Teste" para gerar relatórios.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Planilha de Resultados (QA)</h2>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {reports.length} relatórios
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors shadow-sm disabled:opacity-50"
            >
              {isDeletingBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {isDeletingBulk ? "Apagando..." : `Apagar Selecionados (${selectedIds.size})`}
            </button>
          )}
          {reports.filter(r => !r.result_json?.summary).length > 0 && (
            <button
              onClick={handleGenerateAllSummaries}
              disabled={generatingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 transition-colors shadow-sm disabled:opacity-50"
            >
              {generatingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {generatingAll ? `Gerando (${generateProgress.current}/${generateProgress.total})` : "Gerar Resumos IA (Todos)"}
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium w-10">
                  <input 
                    type="checkbox" 
                    checked={sortedReports.length > 0 && selectedIds.size === sortedReports.length}
                    onChange={handleSelectAll}
                    className="rounded border-muted-foreground/30 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 font-medium w-40">Data da Execução</th>
                <th className="px-4 py-3 font-medium w-36">Tipo de Teste</th>
                <th className="px-4 py-3 font-medium w-48">Link Testado</th>
                <th className="px-4 py-3 font-medium w-64">Cenário / Título</th>
                <th className="px-4 py-3 font-medium w-32">Status (IA)</th>
                <th className="px-4 py-3 font-medium">Resumo do Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedReports.map((report) => {
                const statusInfo = getStatusInfo(report);
                const isJson = !!report.result_json;
                const isSelected = selectedIds.has(report.id);
                
                return (
                  <tr key={report.id} className={cn("hover:bg-muted/30 transition-colors group", isSelected && "bg-emerald-500/5 hover:bg-emerald-500/10")}>
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleToggleSelect(report.id)}
                        className="rounded border-muted-foreground/30 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 opacity-50" />
                      {new Date(report.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-accent text-muted-foreground px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider">
                        {report.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground break-all">
                      {targetUrl ? (
                        <a href={targetUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {targetUrl}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {cleanTitle(report.title)}
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border",
                        statusInfo.bg, statusInfo.color
                      )}>
                        {statusInfo.icon}
                        {statusInfo.label}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs leading-relaxed max-w-md group">
                      {editingSummaryFor === report.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editedSummary}
                            onChange={e => setEditedSummary(e.target.value)}
                            className="w-full h-24 bg-background border border-border rounded p-2 text-xs text-foreground resize-y outline-none focus:border-primary"
                          />
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEditSave(report)} className="flex items-center gap-1 bg-primary text-primary-foreground px-2 py-1 rounded text-[10px] font-bold uppercase hover:bg-primary/90 transition-colors">
                              <Check className="w-3 h-3" /> Salvar
                            </button>
                            <button onClick={() => setEditingSummaryFor(null)} className="flex items-center gap-1 bg-muted text-muted-foreground px-2 py-1 rounded text-[10px] font-bold uppercase hover:bg-accent transition-colors">
                              <X className="w-3 h-3" /> Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="whitespace-pre-wrap max-h-32 overflow-y-auto pr-2">
                            {getSummary(report)}
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1">
                            {!report.result_json?.summary ? (
                              <button
                                onClick={() => handleGenerateSummary(report)}
                                disabled={generatingSummaryFor === report.id || generatingAll}
                                className="self-start text-[10px] uppercase font-bold text-sky-500 bg-sky-500/10 px-2 py-1 rounded hover:bg-sky-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                              >
                                {generatingSummaryFor === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                Gerar Resumo IA
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGenerateSummary(report)}
                                disabled={generatingSummaryFor === report.id || generatingAll}
                                className="self-start text-[10px] uppercase font-bold text-sky-500/70 hover:text-sky-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                                title="Gerar Novamente"
                              >
                                {generatingSummaryFor === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                Regerar IA
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleEditStart(report)}
                              className="self-start text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                              title="Editar Manualmente"
                            >
                              <Edit2 className="w-3 h-3" /> Editar
                            </button>
                            <button
                              onClick={() => handleDelete(report.id)}
                              className="self-start text-[10px] uppercase font-bold text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                              title="Apagar Relatório"
                            >
                              <Trash2 className="w-3 h-3" /> Apagar
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
