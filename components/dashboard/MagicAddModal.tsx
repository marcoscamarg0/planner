"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Loader2, Check, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface MagicAddModalProps {
  open: boolean;
  onClose: () => void;
}

export function MagicAddModal({ open, onClose }: MagicAddModalProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const router = useRouter();

  const handleClose = () => {
    setText("");
    setSuccess(false);
    setResultMsg("");
    setLoading(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);

    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: text.trim()
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(true);
        setResultMsg(data.actionTaken || "Ação executada com sucesso!");
        setTimeout(() => {
          handleClose();
          if (data.targetProjectId) {
            router.push(`/projects/${data.targetProjectId}`);
          } else {
            router.push(`/dashboard`);
          }
          router.refresh();
        }, 2000);
      } else {
        alert("Ocorreu um erro ao processar. Tente novamente.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar com a IA.");
    } finally {
      if (!success) setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            onClick={!loading ? handleClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="magic-add-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[70] px-4"
          >
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
              {/* Decorative background glow */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Command className="w-4 h-4 text-primary" />
                  </div>
                  <h2
                    id="magic-add-title"
                    className="text-lg font-semibold text-foreground tracking-tight"
                  >
                    Command Center
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  aria-label="Fechar"
                  className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground flex items-center justify-between">
                    O que você quer fazer?
                    <span className="text-xs text-muted-foreground font-normal">IA interpreta sua intenção</span>
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={loading || success}
                    placeholder="Ex: 'Apague o projeto X', 'Renomeie o projeto Y para Z', ou 'Adicione a demanda W no projeto X'"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all"
                    autoFocus
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !text.trim() || success}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300",
                      success
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                        : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]",
                      "disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        A IA está executando...
                      </>
                    ) : success ? (
                      <>
                        <Check className="w-4 h-4" />
                        {resultMsg}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Executar Comando
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
