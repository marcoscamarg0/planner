"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FolderKanban, Plus, TestTube2, CheckSquare, Zap, FileText, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const commands = [
  { id: "projects", title: "Ir para Projetos", icon: FolderKanban, href: "/projects" },
  { id: "new-project", title: "Criar novo Projeto", icon: Plus, action: () => alert("Não implementado ainda") },
  { id: "tasks", title: "Ir para Tarefas", icon: CheckSquare, href: "/dashboard" },
  { id: "qa", title: "Testes (QA) / Smart Run", icon: TestTube2, href: "/qa" },
  { id: "automations", title: "Ir para Automações", icon: Zap, href: "/dashboard" },
  { id: "docs", title: "Ir para Documentos", icon: FileText, href: "/dashboard" },
  { id: "settings", title: "Configurações", icon: Settings, href: "/settings" },
];

export function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (cmd: typeof commands[0]) => {
    setOpen(false);
    if (cmd.href) {
      router.push(cmd.href);
    } else if (cmd.action) {
      cmd.action();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed left-[50%] top-[20%] z-50 w-full max-w-lg translate-x-[-50%] rounded-xl border border-border bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
              >
                <div className="flex items-center border-b border-border px-4 py-3 gap-3">
                  <Search className="w-5 h-5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Digite um comando ou busque..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    autoFocus
                  />
                  <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    ESC
                  </kbd>
                </div>
                
                <div className="overflow-y-auto p-2">
                  {filtered.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      Nenhum resultado encontrado.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Sugestões
                      </div>
                      {filtered.map((cmd) => (
                        <button
                          key={cmd.id}
                          onClick={() => handleSelect(cmd)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                            "hover:bg-accent hover:text-foreground text-muted-foreground"
                          )}
                        >
                          <cmd.icon className="w-4 h-4" />
                          <span className="flex-1">{cmd.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
