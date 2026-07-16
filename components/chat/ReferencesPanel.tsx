"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  FileText,
  StickyNote,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeSource, KnowledgeSourceType } from "@/types";

const TYPE_META: Record<
  KnowledgeSourceType,
  { icon: typeof Link2; label: string; color: string }
> = {
  link: { icon: Link2, label: "Link", color: "text-sky-500 bg-sky-500/10" },
  pdf: { icon: FileText, label: "PDF", color: "text-rose-500 bg-rose-500/10" },
  text: { icon: StickyNote, label: "Texto", color: "text-amber-500 bg-amber-500/10" },
};

export function ReferencesPanel() {
  const [references, setReferences] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [activeType, setActiveType] = useState<KnowledgeSourceType>("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReferences = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/references");
      if (res.ok) {
        const data = await res.json();
        setReferences(data.references || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferences();
  }, []);

  const resetForm = () => {
    setTitle("");
    setUrl("");
    setText("");
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let res: Response;

      if (activeType === "pdf") {
        if (!file) {
          setError("Selecione um arquivo PDF");
          setSubmitting(false);
          return;
        }
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());
        res = await fetch("/api/references", { method: "POST", body: form });
      } else if (activeType === "link") {
        if (!url.trim()) {
          setError("Informe uma URL válida");
          setSubmitting(false);
          return;
        }
        res = await fetch("/api/references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "link", url: url.trim(), title: title.trim() }),
        });
      } else {
        if (!text.trim()) {
          setError("Digite o conteúdo do texto");
          setSubmitting(false);
          return;
        }
        res = await fetch("/api/references", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "text", content: text.trim(), title: title.trim() }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao adicionar referência");
      }

      setReferences((prev) => [data.reference, ...prev]);
      resetForm();
      setFormOpen(false);
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar referência");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(`/api/references/${id}`, { method: "DELETE" });
    } catch {
      loadReferences();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Referências</h3>
          <p className="text-xs text-muted-foreground">
            Links, PDFs e textos que a IA pode consultar
          </p>
        </div>
        <button
          onClick={() => {
            setFormOpen((v) => !v);
            setError(null);
          }}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
            formOpen
              ? "bg-muted text-muted-foreground hover:bg-accent"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
          aria-label={formOpen ? "Fechar formulário" : "Adicionar referência"}
        >
          {formOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border shrink-0"
          >
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="flex gap-1.5 bg-secondary/60 p-1 rounded-xl">
                {(Object.keys(TYPE_META) as KnowledgeSourceType[]).map((t) => {
                  const meta = TYPE_META[t];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActiveType(t)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        activeType === t
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título (opcional)"
                className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-ring"
              />

              {activeType === "link" && (
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://exemplo.com/documento"
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-ring"
                />
              )}

              {activeType === "text" && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Cole ou digite o texto de referência..."
                  rows={4}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-ring resize-none"
                />
              )}

              {activeType === "pdf" && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-medium"
                />
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processando...
                  </>
                ) : (
                  "Adicionar referência"
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : references.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-muted-foreground">
              Nenhuma referência ainda. Adicione links, PDFs ou textos para que a
              IA possa consultá-los nas conversas.
            </p>
          </div>
        ) : (
          references.map((ref) => {
            const meta = TYPE_META[ref.type as KnowledgeSourceType] || TYPE_META.link;
            const Icon = meta.icon;
            return (
              <div
                key={ref.id}
                className="group p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{ref.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {ref.content.slice(0, 140)}
                    </p>
                    {ref.source_url && (
                      <a
                        href={ref.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary mt-1.5 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir link
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(ref.id)}
                    aria-label="Remover referência"
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
