"use client";

import { useState } from "react";
import { Sparkles, Network, Loader2 } from "lucide-react";
import { MermaidChart } from "@/components/dashboard/MermaidChart";

export default function OrganogramPage() {
  const [prompt, setPrompt] = useState("");
  const [chart, setChart] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setChart(null);

    try {
      const res = await fetch("/api/ai/organogram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na geração do gráfico");
      
      setChart(data.chart);
    } catch (err) {
      alert("Erro: Não foi possível gerar o diagrama no momento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Network className="w-6 h-6 text-primary" />
          Gerador de Organogramas IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Peça para a IA estruturar seus estudos, processos ou fluxos em diagramas visuais.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <form onSubmit={generateChart} className="flex flex-col md:flex-row items-stretch gap-3">
          <div className="flex-1 relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Gere um mapa mental sobre Direito Administrativo..."
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-background/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar Gráfico"}
          </button>
        </form>
      </div>

      <div className="mt-8">
        {chart ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Resultado
            </h2>
            <MermaidChart chart={chart} />
          </div>
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center glass rounded-2xl border-dashed">
              <Network className="w-12 h-12 text-muted-foreground opacity-20 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">
                Nenhum gráfico gerado ainda.
              </p>
              <p className="text-xs text-muted-foreground/60 max-w-sm mt-1">
                Tente pedir um mapa mental, um organograma hierárquico ou um fluxo de processo.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
