"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Bot, User, Loader2, MessageSquare, Library,
  Sparkles, ChevronDown, Paperclip, FileText, FileCode, Trash2
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ReferencesPanel } from "./ReferencesPanel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment?: { name: string; type: "html" | "pdf" };
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-bold text-sm mt-3 mb-1 text-foreground">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-bold text-base mt-3 mb-1 text-foreground">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="font-bold text-lg mt-3 mb-1 text-foreground">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
          <InlineMarkdown text={line.slice(2)} />
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">
          <InlineMarkdown text={content} />
        </li>
      );
    } else if (line.startsWith("  ↳")) {
      elements.push(
        <p key={i} className="text-sm leading-relaxed ml-4 text-emerald-400/80">
          <InlineMarkdown text={line} />
        </p>
      );
    } else if (line.startsWith("---") || line.startsWith("***")) {
      elements.push(<hr key={i} className="my-2 border-border" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed">
          <InlineMarkdown text={line} />
        </p>
      );
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        } else if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        } else if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="bg-black/20 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const MODELS = [
  { key: "auto-free", label: "Automático (Melhor Gratuito)", provider: "OpenRouter" },
  { key: "kimi-k2", label: "Kimi K2", provider: "Moonshot AI" },
  { key: "nemotron-70b", label: "Nvidia Nemotron 70B", provider: "Nvidia" },
  { key: "qwen-coder", label: "Qwen 2.5 Coder", provider: "Alibaba" },
  { key: "laguna-xs", label: "Laguna XS", provider: "Poolside" },
  { key: "cohere-north", label: "North Mini Code", provider: "Cohere" },
];

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const searchParams = useSearchParams();
  const activeTaskId = searchParams.get("taskId");

  const [tab, setTab] = useState<"chat" | "references">("chat");
  const [selectedModel, setSelectedModel] = useState("auto-free");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Olá! Sou o seu **Segundo Cérebro**. Posso:\n- Acessar seus projetos e tarefas\n- Criar tarefas com subtarefas organizadas\n- Analisar **documentos HTML e PDF** que você enviar\n- Responder com base nas suas referências\n\nAnexe um arquivo ou faça uma pergunta!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist chat
  useEffect(() => {
    const saved = localStorage.getItem("chat_messages_v2");
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem("chat_messages_v2", JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (tab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, tab]);

  useEffect(() => {
    if (open && tab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open, tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedFile) || isLoading) return;

    const fileInfo = attachedFile
      ? {
          name: attachedFile.name,
          type: (attachedFile.name.endsWith(".pdf") ? "pdf" : "html") as "html" | "pdf",
        }
      : undefined;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || `📎 Analisando: ${attachedFile?.name}`,
      attachment: fileInfo,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    const fileToSend = attachedFile;
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      let response: Response;
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (fileToSend) {
        const form = new FormData();
        form.append("messages", JSON.stringify(allMessages));
        form.append("model", selectedModel);
        if (activeTaskId) form.append("activeTaskId", activeTaskId);
        form.append("file", fileToSend);
        response = await fetch("/api/ai/chat", { method: "POST", body: form });
      } else {
        response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: allMessages, model: selectedModel, activeTaskId }),
        });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro na requisição: " + response.status);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.reply || "Desculpe, não consegui formular uma resposta.",
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "❌ " + (error?.message || "Erro ao processar mensagem. Tente novamente."),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop (mobile only) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed top-0 right-0 h-screen w-full sm:w-[420px] lg:w-[460px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
            role="dialog"
            aria-label="Assistente IA"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Segundo Cérebro</h2>
                  <p className="text-xs text-muted-foreground">HTML · PDF · Subtarefas · Projetos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:border-primary/40 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <Sparkles className="w-3 h-3 text-primary" />
                    {MODELS.find(m => m.key === selectedModel)?.label || "Modelo"}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <AnimatePresence>
                    {showModelMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        className="absolute right-0 mt-1 w-64 rounded-xl bg-card border border-border shadow-2xl z-50 overflow-hidden"
                      >
                        {MODELS.map(m => (
                          <button
                            key={m.key}
                            onClick={() => { setSelectedModel(m.key); setShowModelMenu(false); }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent transition-colors",
                              selectedModel === m.key && "bg-primary/10 text-primary"
                            )}
                          >
                            <span className="font-medium">{m.label}</span>
                            <span className="text-muted-foreground">{m.provider}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fechar assistente"
                  className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-3 shrink-0">
              <button
                onClick={() => setTab("chat")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors",
                  tab === "chat" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                onClick={() => setTab("references")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors",
                  tab === "references" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Library className="w-4 h-4" />
                Referências
              </button>
            </div>

            {/* Body */}
            {tab === "chat" ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3 max-w-[92%]",
                        msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          msg.role === "user"
                            ? "bg-emerald-500/15 text-emerald-500"
                            : "bg-primary/15 text-primary"
                        )}
                      >
                        {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Attachment badge */}
                        {msg.attachment && (
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium",
                            msg.role === "user" ? "ml-auto flex" : "",
                            msg.attachment.type === "pdf"
                              ? "bg-rose-500/15 text-rose-400"
                              : "bg-sky-500/15 text-sky-400"
                          )}>
                            {msg.attachment.type === "pdf"
                              ? <FileText className="w-3 h-3" />
                              : <FileCode className="w-3 h-3" />}
                            {msg.attachment.name}
                          </div>
                        )}
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-secondary/60 text-foreground border border-border rounded-tl-sm"
                          )}
                        >
                          {msg.role === "user" ? (
                            msg.content
                          ) : (
                            <MarkdownText text={msg.content} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 max-w-[90%]">
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="rounded-2xl px-4 py-3 bg-secondary/60 border border-border rounded-tl-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {attachedFile ? "Analisando documento..." : "Pensando..."}
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 border-t border-border shrink-0 space-y-2">
                  {/* Attached file preview */}
                  <AnimatePresence>
                    {attachedFile && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl"
                      >
                        {attachedFile.name.endsWith(".pdf")
                          ? <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                          : <FileCode className="w-4 h-4 text-sky-400 shrink-0" />}
                        <span className="text-xs text-foreground flex-1 truncate font-medium">
                          {attachedFile.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(attachedFile.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form
                    onSubmit={handleSubmit}
                    className="flex items-end gap-2 bg-secondary/50 border border-border rounded-xl p-1.5 pr-2 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/40 transition-all"
                  >
                    {/* File attach button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".html,.htm,.pdf"
                      className="hidden"
                      onChange={e => setAttachedFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Anexar HTML ou PDF"
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        attachedFile
                          ? "text-primary bg-primary/15"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      placeholder={attachedFile ? "Pergunte sobre o documento anexado..." : "Pergunte, organize ou crie tarefas..."}
                      rows={1}
                      className="flex-1 bg-transparent border-none focus:outline-none px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none max-h-32"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={(!input.trim() && !attachedFile) || isLoading}
                      className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
                      aria-label="Enviar mensagem"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <p className="text-[10px] text-muted-foreground/50 text-center">
                    Suporta HTML e PDF · Cria subtarefas automaticamente
                  </p>
                </div>
              </>
            ) : (
              <ReferencesPanel />
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
