"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateProjectColor, cn } from "@/lib/utils";
import type { Project } from "@/types";

const EMOJIS = ["📁", "🚀", "💡", "🎯", "📊", "🔨", "✨", "🌟", "📝", "🔥"];
const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#10b981", "#06b6d4", "#3b82f6",
];

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export function NewProjectModal({ open, onClose, onCreated }: NewProjectModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const { data, error: err } = await supabase
      .from("projects")
      .insert({
        owner_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        emoji,
        color,
        status: "active",
      })
      .select()
      .single();

    if (err || !data) {
      console.error("Project creation error:", err);
      setError(`Erro do banco: ${err?.message || 'Desconhecido'}`);
      setLoading(false);
      return;
    }

    setTitle("");
    setDescription("");
    setEmoji("📁");
    setColor(COLORS[0]);
    onCreated(data as Project);
  };

  const handleClose = () => {
    if (!loading) {
      setTitle("");
      setDescription("");
      setError(null);
      onClose();
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 px-4"
          >
            <div className="glass rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <h2
                  id="new-project-title"
                  className="text-xl font-bold gradient-text"
                >
                  Novo projeto
                </h2>
                <button
                  onClick={handleClose}
                  aria-label="Fechar modal"
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-white transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Emoji
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setEmoji(e)}
                        className={cn(
                          "w-9 h-9 rounded-xl text-lg transition-all",
                          emoji === e
                            ? "bg-primary/20 ring-2 ring-primary"
                            : "bg-muted hover:bg-accent"
                        )}
                        aria-label={`Emoji ${e}`}
                        aria-pressed={emoji === e}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Cor
                  </label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={cn(
                          "w-7 h-7 rounded-full transition-all",
                          color === c && "ring-2 ring-offset-2 ring-offset-background ring-white/50"
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Cor ${c}`}
                        aria-pressed={color === c}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="project-title"
                    className="text-sm font-medium text-foreground"
                  >
                    Nome do projeto <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="project-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Redesign do site"
                    required
                    autoFocus
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-muted border border-border",
                      "text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                      "transition-all duration-200 text-sm"
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="project-description"
                    className="text-sm font-medium text-foreground"
                  >
                    Descrição{" "}
                    <span className="text-muted-foreground text-xs">(opcional)</span>
                  </label>
                  <textarea
                    id="project-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Objetivo do projeto..."
                    rows={2}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-muted border border-border",
                      "text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                      "transition-all duration-200 text-sm resize-none"
                    )}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    id="create-project-submit"
                    type="submit"
                    disabled={loading || !title.trim()}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold",
                      "hover:bg-primary/90 active:scale-[0.98] transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar projeto"
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
