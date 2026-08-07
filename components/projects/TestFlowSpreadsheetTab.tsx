"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, Loader2, Download, Table2, CheckCircle2, AlertCircle, Play, GitBranch, Square, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestFlowSpreadsheetTabProps {
  projectId: string;
  initialFlowData: any;
}

export function TestFlowSpreadsheetTab({ projectId, initialFlowData }: TestFlowSpreadsheetTabProps) {
  const nodes = initialFlowData?.nodes || [];
  
  // State: mapping nodeId to { status, notes }
  const [spreadsheetState, setSpreadsheetState] = useState<Record<string, { status: string; notes: string }>>(
    initialFlowData?.spreadsheet_state || {}
  );
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Derive initial values for uninitialized nodes
  useEffect(() => {
    let updated = false;
    const newState = { ...spreadsheetState };
    nodes.forEach((node: any) => {
      if (!newState[node.id]) {
        newState[node.id] = { status: "pending", notes: "" };
        updated = true;
      }
    });
    if (updated) {
      setSpreadsheetState(newState);
    }
  }, [nodes]);

  const updateCell = (nodeId: string, field: "status" | "notes", value: string) => {
    setSpreadsheetState(prev => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] || { status: "pending", notes: "" }),
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const updatedFlowData = {
      ...(initialFlowData || {}),
      spreadsheet_state: spreadsheetState
    };
    await supabase.from("projects").update({ flow_data: updatedFlowData }).eq("id", projectId);
    setSaving(false);
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
  };

  const handleExportCSV = () => {
    const header = "Ordem;Passo / Ação;Tipo;Status;Observações\n";
    const rows = nodes.map((node: any, i: number) => {
      const st = spreadsheetState[node.id] || { status: "pending", notes: "" };
      const statusText = st.status === "passed" ? "Sucesso" : st.status === "failed" ? "Falha" : "Pendente";
      const notesClean = st.notes.replace(/"/g, '""').replace(/\n/g, ' ');
      return `${i + 1};"${node.data?.label || ""}";"${node.type || "default"}";"${statusText}";"${notesClean}"`;
    }).join("\n");

    const csv = header + rows;
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Fluxo_Execucao_${projectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-background/50 p-8">
        <Table2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-foreground font-medium mb-1">Planilha vazia</p>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Você ainda não desenhou nenhum passo na aba "Fluxo". 
          Crie seu fluxograma primeiro para acompanhá-lo aqui.
        </p>
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    switch(type) {
      case "start": return <Play className="w-3.5 h-3.5 text-emerald-400" />;
      case "decision": return <GitBranch className="w-3.5 h-3.5 text-amber-400" />;
      case "validation": return <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />;
      case "error": return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case "end": return <Square className="w-3.5 h-3.5 text-slate-400" />;
      default: return <Table2 className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "passed") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (status === "failed") return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Acompanhamento do Fluxo</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saveOk ? "Salvo" : "Salvar Progresso"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium w-16 text-center">#</th>
                <th className="px-4 py-3 font-medium w-48">Tipo</th>
                <th className="px-4 py-3 font-medium min-w-[200px]">Passo / Ação</th>
                <th className="px-4 py-3 font-medium w-48">Status</th>
                <th className="px-4 py-3 font-medium w-96">Observações (Bugs, etc)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {nodes.map((node: any, index: number) => {
                const st = spreadsheetState[node.id] || { status: "pending", notes: "" };
                return (
                  <tr key={node.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 text-center text-muted-foreground font-medium">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(node.type || "default")}
                        <span className="capitalize text-muted-foreground">{node.type || "ação"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {node.data?.label || "Sem nome"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={st.status}
                        onChange={(e) => updateCell(node.id, "status", e.target.value)}
                        className={cn(
                          "w-full text-xs font-semibold px-2 py-1.5 rounded-md border appearance-none cursor-pointer outline-none transition-colors",
                          getStatusColor(st.status)
                        )}
                      >
                        <option value="pending" className="bg-background text-foreground">⏳ Pendente</option>
                        <option value="passed" className="bg-background text-emerald-500">✅ Sucesso (Passou)</option>
                        <option value="failed" className="bg-background text-rose-500">❌ Falha (Bug Encontrado)</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={st.notes}
                        onChange={(e) => updateCell(node.id, "notes", e.target.value)}
                        placeholder="Adicione notas, links, ou prints..."
                        className="w-full bg-transparent border border-transparent group-hover:border-border hover:border-primary/50 focus:border-primary focus:bg-background rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                      />
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
