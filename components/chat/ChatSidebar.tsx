"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, User, Loader2, MessageSquare, Library, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReferencesPanel } from "./ReferencesPanel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  { key: "deepseek-v3", label: "DeepSeek V3", provider: "DeepSeek" },
  { key: "llama-3.1-8b", label: "Llama 3.1 8B", provider: "Meta" },
  { key: "mistral-7b", label: "Mistral 7B", provider: "Mistral" },
  { key: "gemma-3-27b", label: "Gemma 3 27B", provider: "Google" },
  { key: "qwen-3-8b", label: "Qwen 3 8B", provider: "Alibaba" },
];

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const [tab, setTab] = useState<"chat" | "references">("chat");
  const [selectedModel, setSelectedModel] = useState("deepseek-v3");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Olá! Sou o seu Segundo Cérebro. Tenho acesso aos seus projetos e às referências (links, PDFs e textos) que você anexar. Como posso ajudar hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: selectedModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro na requisição: " + response.status);
      }

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
                  <p className="text-xs text-muted-foreground">Assistente com contexto dos seus dados</p>
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
                        className="absolute right-0 mt-1 w-56 rounded-xl bg-card border border-border shadow-2xl z-50 overflow-hidden"
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
                  tab === "chat"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                onClick={() => setTab("references")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-colors",
                  tab === "references"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
                        "flex gap-3 max-w-[90%]",
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
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 max-w-[90%]">
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="rounded-2xl px-4 py-3 bg-secondary/60 border border-border rounded-tl-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Pensando...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-border shrink-0">
                  <form
                    onSubmit={handleSubmit}
                    className="flex items-end gap-2 bg-secondary/50 border border-border rounded-xl p-1.5 pr-2 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/40 transition-all"
                  >
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
                      placeholder="Pergunte sobre seus projetos ou referências..."
                      rows={1}
                      className="flex-1 bg-transparent border-none focus:outline-none px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none max-h-32"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
                      aria-label="Enviar mensagem"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
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
