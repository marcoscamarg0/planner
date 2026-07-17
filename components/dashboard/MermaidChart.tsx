"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface MermaidChartProps {
  chart: string;
}

export function MermaidChart({ chart }: MermaidChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        setError(null);
        setLoading(true);

        if (!window.mermaid) {
          // Load Mermaid script dynamically if not present
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
          script.async = true;
          document.body.appendChild(script);

          await new Promise<void>((resolve, reject) => {
            script.onload = () => {
              window.mermaid?.initialize({ startOnLoad: false, theme: "base", darkMode: true });
              resolve();
            };
            script.onerror = () => reject(new Error("Falha ao carregar o Mermaid"));
          });
        }

        if (isMounted && containerRef.current && window.mermaid) {
          const id = `mermaid-${Date.now()}`;
          // Extract actual mermaid code if wrapped in markdown
          let code = chart.trim();
          if (code.startsWith("```mermaid")) {
            code = code.replace(/^```mermaid\n/, "").replace(/\n```$/, "");
          } else if (code.startsWith("```")) {
            code = code.replace(/^```\w*\n/, "").replace(/\n```$/, "");
          }
          
          const { svg } = await window.mermaid.render(id, code);
          containerRef.current.innerHTML = svg;
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Erro de sintaxe no fluxograma");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (chart) {
      renderChart();
    }

    return () => {
      isMounted = false;
    };
  }, [chart]);

  return (
    <div className="w-full relative flex items-center justify-center bg-black/10 dark:bg-black/20 rounded-xl p-6 min-h-[300px] border border-border/50">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl z-10 backdrop-blur-sm">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      {error ? (
        <div className="text-destructive text-sm text-center">
          <p className="font-semibold">Erro ao renderizar gráfico</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-full flex justify-center items-center overflow-x-auto" />
      )}
    </div>
  );
}

// Add types for window.mermaid
declare global {
  interface Window {
    mermaid?: any;
  }
}
