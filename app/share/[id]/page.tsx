import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ShieldCheck, Calendar, Zap, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Função utilitária para renderizar relatórios baseados em Markdown
const renderMarkdownSimple = (md: string) => {
  return md.split("\n").map((line, i) => {
    if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-black mt-6 mb-4 text-slate-800 border-b pb-2">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold mt-5 mb-3 text-slate-700">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-slate-600">{line.slice(4)}</h3>;
    if (line.startsWith("- ")) return <li key={i} className="ml-4 mb-1 list-disc text-slate-600">{line.slice(2)}</li>;
    if (line.startsWith("* ")) return <li key={i} className="ml-4 mb-1 list-disc text-slate-600">{line.slice(2)}</li>;
    if (line.match(/^\d+\.\s/)) return <li key={i} className="ml-4 mb-1 list-decimal text-slate-600">{line.replace(/^\d+\.\s/, "")}</li>;
    if (line.trim() === "---") return <hr key={i} className="my-6 border-slate-200" />;
    if (line.trim() === "") return <br key={i} />;
    
    // Bold parsing basic
    const bolded = line.split(/(\*\*.*?\*\*)/g).map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    return <p key={i} className="mb-2 text-slate-600 leading-relaxed">{bolded}</p>;
  });
};

export default async function PublicReportSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServiceClient();
  
  const { data: report, error } = await supabase
    .from("qa_reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !report) {
    return notFound();
  }

  const isJson = report.result_json !== null;
  const rawText = report.result_raw || "";

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-primary/20">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 sm:py-16">
        
        {/* Header Public */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-sky-500" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">
                Relatório de Auditoria Público
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {report.title}
            </h1>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1 text-sm text-slate-500 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(report.created_at).toLocaleString("pt-BR")}</span>
            {report.model_used && <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> IA: {report.model_used}</span>}
            <span className="text-[10px] uppercase font-bold mt-1 text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verificado</span>
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-sky-500"></div>
          
          <div className="p-6 sm:p-10">
            {/* Input Context */}
            {report.input_description && (
              <div className="mb-8 p-5 rounded-xl bg-slate-50 border border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Escopo / Contexto do Teste</h3>
                <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                  {report.input_description}
                </p>
              </div>
            )}

            {/* Results Render */}
            <div className="prose prose-slate max-w-none">
              {!isJson ? (
                <div className="space-y-1">
                  {renderMarkdownSimple(rawText)}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <h2 className="text-xl font-bold text-slate-800 m-0">Dados Estruturados do Teste</h2>
                  </div>
                  
                  {report.type === 'smart_runner' && report.result_json.success !== undefined ? (
                    <div className={cn(
                      "p-6 rounded-xl border-l-4 shadow-sm",
                      report.result_json.success ? "bg-emerald-50 border-emerald-500" : "bg-rose-50 border-rose-500"
                    )}>
                      <div className="flex items-start gap-3">
                        {report.result_json.success ? <CheckCircle2 className="w-6 h-6 text-emerald-600" /> : <AlertCircle className="w-6 h-6 text-rose-600" />}
                        <div>
                          <h3 className={cn("text-lg font-bold m-0", report.result_json.success ? "text-emerald-800" : "text-rose-800")}>
                            {report.result_json.success ? "Teste Aprovado" : "Teste Falhou"}
                          </h3>
                          <p className={cn("mt-1 mb-0 text-sm", report.result_json.success ? "text-emerald-600" : "text-rose-600")}>
                            Status da execução: {report.result_json.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <pre className="bg-slate-900 text-sky-300 p-6 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed border border-slate-800 shadow-inner">
                    {JSON.stringify(report.result_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400 font-medium space-x-4">
          <span>Relatório gerado pela Suíte QA Avançada</span>
          <span>&bull;</span>
          <span>Compartilhamento Seguro</span>
        </div>
      </div>
    </div>
  );
}
