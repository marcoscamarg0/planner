"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Table2, 
  Search, 
  FileSpreadsheet, 
  Download,
  CheckSquare,
  Square,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

interface SpreadsheetClientProps {
  initialProjects: Project[];
}

const COLUMNS = [
  "ID",
  "Serviço",
  "Eixo",
  "Produto",
  "Login Integrado",
  "Avaliação do Serviço",
  "Avalição da Página",
  "Links Quebrados",
  "Gratuito",
  "PagTesouro",
  "Contatos",
  "Legislação",
  "Correções e Melhorias"
];

export function SpreadsheetClient({ initialProjects }: SpreadsheetClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter projects by search
  const filteredProjects = initialProjects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    if (selectedIds.size === filteredProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProjects.map(p => p.id)));
    }
  };

  const generateCSV = async () => {
    if (selectedIds.size === 0) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/spreadsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: Array.from(selectedIds) })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro ao gerar planilha");
      }

      const csvContent = await response.text();

      // Create Blob and trigger download
      // Use BOM for Excel compatibility with UTF-8
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Projetos_Export_IA_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      alert("Falha ao gerar planilha: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const allSelected = filteredProjects.length > 0 && selectedIds.size === filteredProjects.length;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Table2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Gerador de Planilhas
              </h1>
              <p className="text-muted-foreground mt-1">
                Selecione os projetos para exportar um resumo executivo em formato CSV.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={generateCSV}
          disabled={selectedIds.size === 0 || isGenerating}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all shadow-sm whitespace-nowrap",
            selectedIds.size > 0 && !isGenerating
              ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-5 h-5" />
          )}
          {isGenerating ? "Analisando Testes (IA)..." : `Gerar Planilha (${selectedIds.size})`}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Project Selection */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Controls */}
          <div className="flex items-center gap-4 bg-card p-2 rounded-2xl border border-border shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar projetos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="w-px h-6 bg-border" />
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allSelected ? "Desmarcar Todos" : "Selecionar Todos"}
            </button>
          </div>

          {/* Project List */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col max-h-[600px]">
            <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
              <AnimatePresence>
                {filteredProjects.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center text-muted-foreground text-sm"
                  >
                    Nenhum projeto encontrado.
                  </motion.div>
                ) : (
                  filteredProjects.map((project) => {
                    const isSelected = selectedIds.has(project.id);
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={project.id}
                        onClick={() => handleToggleSelect(project.id)}
                        className={cn(
                          "group flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all border",
                          isSelected 
                            ? "bg-emerald-500/10 border-emerald-500/30" 
                            : "bg-transparent border-transparent hover:bg-accent/50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0",
                          isSelected 
                            ? "bg-emerald-500 border-emerald-500 text-white" 
                            : "border-muted-foreground/30 group-hover:border-emerald-500/50"
                        )}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                        
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                        
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate transition-colors",
                            isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                          )}>
                            {project.title}
                          </p>
                          {project.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column: Preview / Info */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Table2 className="w-4 h-4 text-emerald-500" />
              Colunas Exportadas
            </h3>
            <div className="flex flex-wrap gap-2">
              {COLUMNS.map((col, idx) => (
                <span 
                  key={idx}
                  className="px-2.5 py-1 text-xs font-medium bg-secondary/50 text-secondary-foreground border border-border/50 rounded-lg"
                >
                  {col}
                </span>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Formato CSV</p>
                  <p className="text-xs text-muted-foreground">
                    Compatível com Excel e Google Sheets.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
            <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
              IA Analisando Resultados
            </h4>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed">
              O sistema utiliza Inteligência Artificial para ler e interpretar todos os 
              relatórios de testes (QA) associados aos projetos selecionados. 
              Ele extrai bugs, falhas e melhorias automaticamente e preenche a planilha para você.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
