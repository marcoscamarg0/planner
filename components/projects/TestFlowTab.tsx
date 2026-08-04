"use client";

import { useState, useCallback, useEffect, memo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
  Panel,
  MarkerType,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Save, Sparkles, Play, CheckCircle2, AlertCircle, GitBranch, Square, Circle, Zap, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Custom Node Components ─── */

const StartNode = memo(({ data }: NodeProps) => (
  <div className="relative flex flex-col items-center group">
    <div className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_0_15px_rgba(100,116,139,0.3)] border border-emerald-400/50 backdrop-blur-md transition-transform group-hover:scale-105">
      <Play className="w-4 h-4 fill-white" />
      <span className="text-[13px] font-bold tracking-wide">{String(data.label)}</span>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-emerald-300 !w-3 !h-3 !border-2 !border-emerald-500 shadow-sm" />
  </div>
));
StartNode.displayName = "StartNode";

const ActionNode = memo(({ data }: NodeProps) => (
  <div className="relative group">
    <Handle type="target" position={Position.Top} className="!bg-sky-400 !w-3 !h-3 !border-2 !border-sky-600" />
    <div className="px-5 py-3.5 rounded-2xl bg-slate-900/80 border border-sky-500/40 text-sky-100 shadow-[0_4px_20px_-4px_rgba(14,165,233,0.3)] backdrop-blur-lg min-w-[170px] max-w-[240px] transition-all group-hover:border-sky-400/80 group-hover:shadow-[0_0_20px_rgba(14,165,233,0.4)]">
      <span className="text-[13px] font-medium leading-snug block text-center">{String(data.label)}</span>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-sky-400 !w-3 !h-3 !border-2 !border-sky-600" />
  </div>
));
ActionNode.displayName = "ActionNode";

const DecisionNode = memo(({ data }: NodeProps) => (
  <div className="relative flex flex-col items-center group">
    <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-3 !h-3 !border-2 !border-amber-600" />
    <div
      className="flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/60 text-amber-200 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.3)] backdrop-blur-md transition-all group-hover:border-amber-400 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]"
      style={{ width: 170, height: 85, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
    >
      <span className="text-[11px] font-bold text-center px-10 leading-snug">{String(data.label)}</span>
    </div>
    <Handle type="source" position={Position.Bottom} id="yes" className="!bg-emerald-400 !w-3 !h-3 !border-2 !border-emerald-600" />
    <Handle type="source" position={Position.Right} id="no" className="!bg-rose-400 !w-3 !h-3 !border-2 !border-rose-600" style={{ top: "50%" }} />
  </div>
));
DecisionNode.displayName = "DecisionNode";

const ValidationNode = memo(({ data }: NodeProps) => (
  <div className="relative group">
    <Handle type="target" position={Position.Top} className="!bg-violet-400 !w-3 !h-3 !border-2 !border-violet-600" />
    <div className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/50 text-violet-100 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.3)] backdrop-blur-md min-w-[170px] max-w-[240px] transition-all group-hover:border-violet-400 group-hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-violet-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
        <span className="text-[13px] font-medium leading-snug">{String(data.label)}</span>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-violet-400 !w-3 !h-3 !border-2 !border-violet-600" />
  </div>
));
ValidationNode.displayName = "ValidationNode";

const ErrorNode = memo(({ data }: NodeProps) => (
  <div className="relative group">
    <Handle type="target" position={Position.Top} className="!bg-rose-400 !w-3 !h-3 !border-2 !border-rose-600" />
    <Handle type="target" position={Position.Left} className="!bg-rose-400 !w-3 !h-3 !border-2 !border-rose-600" />
    <div className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500/20 to-red-500/20 border border-rose-500/50 text-rose-100 shadow-[0_4px_20px_-4px_rgba(244,63,94,0.3)] backdrop-blur-md min-w-[170px] max-w-[240px] transition-all group-hover:border-rose-400 group-hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
        <span className="text-[13px] font-medium leading-snug">{String(data.label)}</span>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} className="!bg-rose-400 !w-3 !h-3 !border-2 !border-rose-600" />
  </div>
));
ErrorNode.displayName = "ErrorNode";

const EndNode = memo(({ data }: NodeProps) => (
  <div className="relative flex flex-col items-center group">
    <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-slate-600" />
    <div className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-[0_0_15px_rgba(100,116,139,0.3)] border border-slate-500 backdrop-blur-md transition-transform group-hover:scale-105 min-w-[150px] justify-center">
      <Square className="w-3.5 h-3.5 fill-white" />
      <span className="text-[13px] font-bold tracking-wide">{String(data.label)}</span>
    </div>
  </div>
));
EndNode.displayName = "EndNode";

// Override default input/output with our custom ones
const InputNode = StartNode;
const OutputNode = EndNode;

const nodeTypes = {
  start: StartNode,
  action: ActionNode,
  decision: DecisionNode,
  validation: ValidationNode,
  error: ErrorNode,
  end: EndNode,
  // Map react-flow built-in types to our custom ones
  input: StartNode,
  output: EndNode,
  default: ActionNode,
};

/* ─── Default edge style ─── */
const edgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#64748b" },
  style: { stroke: "#64748b", strokeWidth: 2 },
  animated: false,
};

const initialNodes: Node[] = [
  { id: "1", position: { x: 300, y: 50 }, data: { label: "Início do Teste" }, type: "start" },
];
const initialEdges: Edge[] = [];

interface TestFlowTabProps {
  projectId: string;
  initialFlowData: any;
}

export function TestFlowTab({ projectId, initialFlowData }: TestFlowTabProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlowData?.nodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowData?.edges || initialEdges);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // AI Generator state
  const [testCases, setTestCases] = useState<any[]>([]);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTestCases = async () => {
      try {
        const res = await fetch(`/api/ai/qa?projectId=${projectId}`);
        const data = await res.json();
        if (data.reports) {
          const tcs = data.reports
            .filter((r: any) => r.type === "test_cases" && r.result_json?.test_cases)
            .flatMap((r: any) => r.result_json.test_cases);
          setTestCases(tcs);
        }
      } catch {}
    };
    fetchTestCases();
  }, [projectId]);

  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges((eds) =>
        addEdge({ ...params, ...edgeOptions, animated: false }, eds)
      ),
    [setEdges]
  );

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("projects").update({ flow_data: { nodes, edges } }).eq("id", projectId);
    setSaving(false);
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2000);
  };

  const addNode = (type: string, label: string) => {
    const newNode: Node = {
      id: Date.now().toString(),
      type,
      position: { x: Math.random() * 300 + 120, y: Math.random() * 300 + 100 },
      data: { label },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleGenerateAI = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/ai/test-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCaseText: prompt }),
      });
      const data = await res.json();
      if (data.success && data.flow) {
        // Apply default edge styles to all generated edges
        const styledEdges = (data.flow.edges || []).map((e: any) => ({
          ...e,
          ...edgeOptions,
          label: e.label || undefined,
          labelStyle: { fill: "#94a3b8", fontWeight: 600, fontSize: 10 },
          labelBgStyle: { fill: "#1e293b", fillOpacity: 0.85 },
        }));
        setNodes(data.flow.nodes || []);
        setEdges(styledEdges);
      } else {
        setGenError(data.error || "Erro desconhecido");
      }
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative" style={{ background: "hsl(var(--background))" }}>
      {/* ── Sidebar ── */}
      <div className="absolute top-4 left-4 z-10 bg-card/95 backdrop-blur-sm border border-border shadow-xl rounded-2xl p-4 space-y-4 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto">

        {/* AI Generator */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">Gerador com IA</h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Importar Caso de Teste
            </label>
            <select
              className="w-full bg-background border border-border rounded-lg text-xs p-2 focus:outline-none focus:border-primary/50 transition-colors"
              onChange={(e) => {
                if (e.target.value) {
                  if (e.target.value === "ALL") {
                    const allText = testCases.map((tc, i) => 
                      `[Caso ${i + 1}: ${tc.title}]\nPassos:\n${tc.steps?.map((s: string, j: number) => `${j + 1}. ${s}`).join("\n") || ""}\nResultado Esperado: ${tc.expected_result || ""}`
                    ).join("\n\n---\n\n");
                    setPrompt(`Gere um fluxo unificado cobrindo todos estes cenários:\n\n${allText}`);
                  } else {
                    const tc = testCases.find((t) => t.id === e.target.value);
                    if (tc) {
                      setPrompt(`Título: ${tc.title}\n\nPassos:\n${tc.steps?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n") || ""}\n\nResultado Esperado: ${tc.expected_result || ""}`);
                    }
                  }
                }
              }}
            >
              <option value="">Selecione um caso de teste...</option>
              {testCases.length > 1 && (
                <option value="ALL">🌟 Importar TODOS (Suíte Completa)</option>
              )}
              {testCases.map((tc, idx) => (
                <option key={tc.id || idx} value={tc.id}>{tc.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ou descreva o fluxo
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: 1. Acessar login 2. Preencher email e senha 3. Clicar em Entrar 4. Validar dashboard..."
              className="w-full bg-background border border-border rounded-lg text-xs p-2.5 h-28 resize-none focus:outline-none focus:border-primary/50 transition-colors leading-relaxed"
            />
          </div>

          {genError && (
            <p className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{genError}</p>
          )}

          <button
            onClick={handleGenerateAI}
            disabled={generating || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md shadow-primary/25"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? "Gerando fluxo..." : "Gerar Fluxograma"}
          </button>
        </div>

        <hr className="border-border" />

        {/* Manual Blocks */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Blocos Manuais</h3>
          <button onClick={() => addNode("start", "Início")}
            className="w-full text-left px-3 py-2 text-xs font-medium rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-2">
            <Play className="w-3 h-3 fill-emerald-400" /> Início / Acesso
          </button>
          <button onClick={() => addNode("action", "Ação do usuário")}
            className="w-full text-left px-3 py-2 text-xs font-medium rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors flex items-center gap-2">
            <Zap className="w-3 h-3" /> Ação (Click / Input)
          </button>
          <button onClick={() => addNode("decision", "Condição?")}
            className="w-full text-left px-3 py-2 text-xs font-medium rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex items-center gap-2">
            <GitBranch className="w-3 h-3" /> Decisão (Sim / Não)
          </button>
          <button onClick={() => addNode("validation", "Validar resultado")}
            className="w-full text-left px-3 py-2 text-xs font-medium rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3" /> Validação (Assert)
          </button>
          <button onClick={() => addNode("error", "Erro esperado")}
            className="w-full text-left px-3 py-2 text-xs font-medium rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-2">
            <AlertCircle className="w-3 h-3" /> Erro / Exceção
          </button>
          <button onClick={() => addNode("end", "Fim")}
            className="w-full text-left px-3 py-2 text-xs font-medium rounded-xl bg-slate-500/10 text-slate-400 border border-slate-500/20 hover:bg-slate-500/20 transition-colors flex items-center gap-2">
            <Square className="w-3 h-3" /> Fim / Resultado
          </button>
        </div>

        <hr className="border-border" />

        {/* Actions */}
        <div className="space-y-2">
          <button onClick={() => { setNodes(initialNodes); setEdges([]); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-xl border border-border text-muted-foreground hover:text-rose-400 hover:border-rose-400/40 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Limpar Canvas
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl border border-border hover:bg-muted/50 transition-colors disabled:opacity-50 text-foreground"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveOk ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
            {saveOk ? "Salvo!" : "Salvar Fluxo"}
          </button>
        </div>
      </div>

      {/* ── React Flow Canvas ── */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={edgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="w-full h-full"
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="!bg-card !border-border !shadow-lg !rounded-xl" />
        <MiniMap
          className="!bg-card !border-border !shadow-lg !rounded-xl"
          nodeColor={(n) => {
            const colors: Record<string, string> = {
              start: "#10b981", input: "#10b981",
              action: "#0ea5e9", default: "#0ea5e9",
              decision: "#f59e0b",
              validation: "#a855f7", output: "#64748b",
              error: "#f43f5e",
              end: "#64748b",
            };
            return colors[n.type || "default"] || "#64748b";
          }}
          nodeStrokeWidth={0}
          maskColor="rgba(0,0,0,0.4)"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(148,163,184,0.15)" />

        {/* Legend */}
        <Panel position="bottom-right">
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg p-3 space-y-1.5 text-[10px] text-muted-foreground">
            <p className="font-semibold uppercase tracking-wider text-[9px] mb-2">Legenda</p>
            {[
              { color: "bg-emerald-500", label: "Início" },
              { color: "bg-sky-500", label: "Ação" },
              { color: "bg-amber-500", label: "Decisão" },
              { color: "bg-violet-500", label: "Validação" },
              { color: "bg-rose-500", label: "Erro" },
              { color: "bg-slate-500", label: "Fim" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
