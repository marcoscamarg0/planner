"use client";

import { useState, useCallback, useEffect } from "react";
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
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const initialNodes: Node[] = [
  { id: "1", position: { x: 250, y: 50 }, data: { label: "Início do Teste" }, type: "input" },
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

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleSave = async () => {
    setSaving(true);
    const flowData = { nodes, edges };
    const supabase = createClient();
    
    await supabase
      .from("projects")
      .update({ flow_data: flowData })
      .eq("id", projectId);
      
    setTimeout(() => setSaving(false), 500);
  };

  const addNode = (type: "default" | "input" | "output", label: string) => {
    const newNode: Node = {
      id: Date.now().toString(),
      type,
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { label },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-background/50">
      <div className="absolute top-4 left-4 z-10 bg-card border border-border shadow-md rounded-xl p-3 space-y-3 w-48">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Blocos de Teste
        </h3>
        <button
          onClick={() => addNode("input", "Página inicial")}
          className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          + Acessar Página
        </button>
        <button
          onClick={() => addNode("default", "Clicar em botão")}
          className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
        >
          + Ação (Click/Type)
        </button>
        <button
          onClick={() => addNode("output", "Validar texto na tela")}
          className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
        >
          + Validação (Assert)
        </button>

        <div className="pt-3 mt-3 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar Fluxo
          </button>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="w-full h-full"
      >
        <Controls />
        <MiniMap 
          nodeStrokeColor={(n) => {
            if (n.type === 'input') return '#10b981';
            if (n.type === 'output') return '#a855f7';
            return '#3b82f6';
          }}
          nodeColor={(n) => {
            return 'rgba(255, 255, 255, 0.1)';
          }}
        />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
