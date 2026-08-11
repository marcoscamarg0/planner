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
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/projects") return "Projetos";
    if (pathname.startsWith("/projects/")) return title || "Detalhes do Projeto";
    if (pathname === "/qa") return "Testes (QA)";
    return title || "";
  };

  return (
    <>
      <header
        className="h-14 border-b border-border bg-background sticky top-0 z-30 flex items-center px-4 justify-between transition-colors"
        role="banner"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground truncate max-w-xs font-outfit">
            {getBreadcrumbs()}
          </h1>
        </div>

        <div className="flex-1 flex justify-center max-w-md mx-4 hidden md:flex">
          <button
            onClick={() => setCmdOpen(true)}
            className="w-full h-9 rounded-md bg-surface border border-border flex items-center px-3 gap-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Busque ou digite um comando...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              title="Assistente IA"
              className="w-9 h-9 rounded-md hover:bg-accent flex items-center justify-center transition-colors text-primary relative"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title="Notificações"
                className="w-9 h-9 rounded-md hover:bg-accent flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground relative"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-background" />
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="w-80 bg-surface border border-border rounded-lg shadow-lg p-2 z-50">
                <div className="px-2 py-1.5 mb-1 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">Notificações</span>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Sem novas notificações
                  </div>
                ) : (
                  notifications.map(n => (
                    <DropdownMenu.Item key={n.id} className="text-xs p-2 hover:bg-accent outline-none cursor-pointer rounded-md">
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
              <button className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-semibold ml-2 hover:bg-primary/20 transition-colors">
                {initials}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className="w-48 bg-surface border border-border rounded-lg shadow-lg p-1 z-50">
                <div className="px-2 py-1.5 mb-1 border-b border-border">
                  <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </div>
                <DropdownMenu.Item className="flex items-center gap-2 px-2 py-1.5 text-sm outline-none cursor-pointer hover:bg-accent rounded-md">
                  <User className="w-4 h-4 text-muted-foreground" />
                  Perfil
                </DropdownMenu.Item>
                <DropdownMenu.Item 
                  onSelect={handleLogout}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm outline-none cursor-pointer text-destructive hover:bg-destructive/10 rounded-md"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
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
