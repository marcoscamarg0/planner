"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, LogOut, User, Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { Profile, Project } from "@/types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { GovGeometricRibbon } from "@/components/brand/GovGeometricRibbon";

interface TopbarProps {
  profile: Profile | null;
  title?: string;
  onOpenChat?: () => void;
  projects?: Project[];
}

interface Notification {
  id: string;
  title: string;
  due_date: string;
  status: string;
  projects: { id: string; title: string; color: string };
}

export function Topbar({ profile, title, onOpenChat, projects = [] }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (e) {}
    }
    fetchNotifications();
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? "?";

  // Breadcrumb generator
  const getBreadcrumbs = () => {
    if (pathname === "/dashboard") return "Dashboard Geral";
    if (pathname === "/projects") return "Gestão de Projetos";
    if (pathname.startsWith("/projects/")) return title || "Detalhes do Projeto";
    if (pathname === "/qa") return "Central de Testes (QA)";
    if (pathname === "/spreadsheet") return "Gerador de Planilhas";
    if (pathname === "/settings") return "Configurações";
    return title || "Planner";
  };

  return (
    <>
      <header
        className="h-14 bg-card/90 backdrop-blur-md sticky top-0 z-30 flex items-center px-4 justify-between transition-colors border-b border-border/70 shadow-xs"
        role="banner"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h1 className="text-sm font-bold text-foreground truncate max-w-xs font-heading">
              {getBreadcrumbs()}
            </h1>
          </div>
        </div>

        <div className="flex-1 flex justify-center max-w-md mx-4 hidden md:flex">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full h-9 rounded-lg bg-muted/60 hover:bg-muted border border-border/60 flex items-center px-3 gap-2 text-xs text-muted-foreground hover:text-foreground transition-all shadow-xs group"
          >
            <Search className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
            <span className="flex-1 text-left">Buscar tarefas, projetos ou comandos...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border/80 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-2xs">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              title="Assistente IA — Ministério dos Transportes"
              className="h-9 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 flex items-center gap-2 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Assistente IA</span>
            </button>
          )}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title="Notificações"
                className="w-9 h-9 rounded-lg hover:bg-muted/80 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground relative border border-transparent hover:border-border/60"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-background" />
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="w-80 bg-card border border-border rounded-xl shadow-xl p-2 z-50 animate-in fade-in-50 zoom-in-95">
                <div className="px-2 py-1.5 mb-1 border-b border-border/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Notificações</span>
                  <span className="text-[10px] text-muted-foreground">{notifications.length} novas</span>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Sem novas notificações
                  </div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenu.Item key={n.id} className="text-xs p-2 hover:bg-muted outline-none cursor-pointer rounded-lg transition-colors">
                      {n.title}
                    </DropdownMenu.Item>
                  ))
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <ThemeToggle />

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="w-8.5 h-8.5 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold ml-1 hover:bg-primary/20 transition-all hover:ring-2 hover:ring-primary/25 cursor-pointer">
                {initials}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="w-56 bg-card border border-border rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in-50 zoom-in-95">
                <div className="px-2.5 py-2 mb-1 border-b border-border/60">
                  <p className="text-sm font-semibold text-foreground truncate">{profile?.full_name || "Usuário"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
                  <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground">
                    Ministério dos Transportes
                  </div>
                </div>
                <DropdownMenu.Item
                  onClick={() => router.push("/settings")}
                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium outline-none cursor-pointer hover:bg-muted rounded-lg transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  Perfil & Configurações
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onSelect={handleLogout}
                  className="flex items-center gap-2 px-2.5 py-2 text-xs font-medium outline-none cursor-pointer text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair do sistema
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      
      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
    </>
  );
}
