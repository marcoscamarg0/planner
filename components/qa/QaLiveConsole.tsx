"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Copy, Check, Trash2, ChevronDown, ChevronUp, Sparkles, Activity, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error" | "ai";
  message: string;
}

interface QaLiveConsoleProps {
  logs: LogEntry[];
  loading: boolean;
  onClear?: () => void;
  title?: string;
  defaultExpanded?: boolean;
}

export function QaLiveConsole({
  logs,
  loading,
  onClear,
  title = "Console de Execução & IA (Appwrite Cloud)",
  defaultExpanded = true,
}: QaLiveConsoleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o final quando novos logs chegarem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Se começar a carregar, expande automaticamente
  useEffect(() => {
    if (loading) {
      setExpanded(true);
    }
  }, [loading]);

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (logs.length === 0 && !loading) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#070b14] shadow-2xl shadow-cyan-950/40 my-4"
    >
      {/* Top Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0b1220] border-b border-cyan-500/20 select-none">
        <div className="flex items-center gap-3">
          {/* macOS / Linux Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block shadow-sm" />
          </div>

          <div className="h-4 w-[1px] bg-white/10 mx-0.5" />

          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-xs font-semibold text-slate-200 tracking-wide">
              {title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          {loading ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              PROCESSANDO IA...
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              PRONTO
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
            title="Copiar Logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {onClear && (
            <button
              onClick={onClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Limpar Console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
            title={expanded ? "Recolher Console" : "Expandir Console"}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Log Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-1.5 bg-[#050811] selection:bg-cyan-500/30 selection:text-cyan-200"
            >
              {logs.map((log) => {
                let badgeClass = "text-slate-400";
                let textClass = "text-slate-300";

                if (log.level === "success") {
                  badgeClass = "text-emerald-400 font-bold";
                  textClass = "text-emerald-300";
                } else if (log.level === "error") {
                  badgeClass = "text-rose-400 font-bold";
                  textClass = "text-rose-300 bg-rose-950/20 px-1 rounded";
                } else if (log.level === "warn") {
                  badgeClass = "text-amber-400 font-bold";
                  textClass = "text-amber-300";
                } else if (log.level === "ai") {
                  badgeClass = "text-cyan-400 font-bold";
                  textClass = "text-cyan-200 font-semibold";
                }

                return (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed font-mono">
                    <span className="text-slate-500 shrink-0 select-none text-[10px] mt-0.5">
                      [{log.timestamp}]
                    </span>
                    <span className={cn("shrink-0 uppercase text-[10px] px-1.5 py-0.2 rounded border border-white/5", badgeClass)}>
                      {log.level}
                    </span>
                    <span className={cn("flex-1 whitespace-pre-wrap break-all", textClass)}>
                      {log.message}
                    </span>
                  </div>
                );
              })}

              {loading && (
                <div className="flex items-center gap-2 text-cyan-400 pt-1">
                  <span className="text-slate-500 select-none text-[10px]">
                    [{new Date().toLocaleTimeString("pt-BR")}]
                  </span>
                  <span className="animate-spin inline-block">⚡</span>
                  <span className="text-cyan-300 animate-pulse font-mono">
                    Aguardando resposta do modelo neural...
                  </span>
                  <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-0.5" />
                </div>
              )}
            </div>

            {/* Terminal Footer Bar */}
            <div className="px-4 py-1.5 bg-[#090f1d] border-t border-cyan-500/10 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Appwrite Cloud · planner_db · QA Engine
              </span>
              <span>{logs.length} eventos registrados</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
