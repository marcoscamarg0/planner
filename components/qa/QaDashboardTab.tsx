"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { 
  Loader2, Play, FileText, Download, CheckCircle2, AlertCircle, AlertTriangle, Sparkles, Printer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface QaDashboardTabProps {
  projectId: string;
}

export function QaDashboardTab({ projectId }: QaDashboardTabProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);

  useEffect(() => {
    fetchReports();
  }, [projectId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ai/qa?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        const consolidated = data.reports.find((r: any) => r.type === "consolidated_report");
        if (consolidated) setAiReport(consolidated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAiReport = async () => {
    try {
      setGeneratingReport(true);
      const res = await fetch("/api/ai/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_type: "consolidated_report",
          input: "",
          project_id: projectId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiReport(data.report);
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Process data for charts
  const typesCount = reports.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(typesCount).map(([name, value]) => ({ name, value }));
  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6'];

  const testCases = reports.filter(r => r.type === "test_cases" && r.result_json?.test_cases);
  let totalTests = 0, totalHappy = 0, totalError = 0, totalEdge = 0;
  
  testCases.forEach(tc => {
    const list = tc.result_json?.test_cases || [];
    totalTests += list.length;
    totalHappy += list.filter((i: any) => i.category === "happy_path").length;
    totalError += list.filter((i: any) => i.category === "error").length;
    totalEdge += list.filter((i: any) => i.category === "edge_case").length;
  });

  const barData = [
    { name: 'Happy Path', value: totalHappy, fill: '#10b981' },
    { name: 'Erro Esperado', value: totalError, fill: '#ef4444' },
    { name: 'Caso de Borda', value: totalEdge, fill: '#f59e0b' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6 bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">QA & Testes</h2>
          <p className="text-muted-foreground">Métricas, relatórios e geração de IA para o projeto.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.open("/qa?projectId=" + projectId, "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Abrir QA Runner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <FileText className="w-4 h-4" />
            <h3 className="font-medium text-sm">Total de Relatórios</h3>
          </div>
          <p className="text-3xl font-bold">{reports.length}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h3 className="font-medium text-sm">Casos de Teste (Happy Path)</h3>
          </div>
          <p className="text-3xl font-bold">{totalHappy}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <h3 className="font-medium text-sm">Casos de Teste (Erros)</h3>
          </div>
          <p className="text-3xl font-bold">{totalError}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm h-[300px]">
          <h3 className="font-medium text-sm text-muted-foreground mb-4">Tipos de Relatórios Gerados</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl shadow-sm h-[300px]">
          <h3 className="font-medium text-sm text-muted-foreground mb-4">Casos de Teste por Categoria</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" tick={{fontSize: 12}} />
              <YAxis tick={{fontSize: 12}} />
              <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Relatório Executivo de IA
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateAiReport}
              disabled={generatingReport}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gerar / Atualizar Relatório
            </button>
            {aiReport && (
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border hover:bg-accent rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Exportar PDF
              </button>
            )}
          </div>
        </div>

        {aiReport ? (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm prose prose-sm md:prose-base dark:prose-invert max-w-none print:shadow-none print:border-none print:p-0">
            <div dangerouslySetInnerHTML={{ __html: aiReport.result_raw?.replace(/\n/g, "<br/>") }} />
          </div>
        ) : (
          <div className="bg-card/50 border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground mb-4 opacity-50" />
            <h4 className="text-base font-medium mb-1">Nenhum relatório consolidado</h4>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Clique em "Gerar Relatório" para que a IA analise todos os testes deste projeto e gere um sumário executivo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
