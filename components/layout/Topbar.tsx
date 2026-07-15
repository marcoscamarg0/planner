"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, User, ChevronDown, AlertCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MagicAddModal } from "@/components/dashboard/MagicAddModal";
import type { Profile } from "@/types";

interface TopbarProps {
  profile: Profile | null;
  title?: string;
}

interface Notification {
  id: string;
  title: string;
  due_date: string;
  status: string;
  projects: { id: string; title: string; color: string };
}

export function Topbar({ profile, title }: TopbarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [magicOpen, setMagicOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header
      className="h-14 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-6 justify-between"
      role="banner"
    >
      {title && (
        <h1 className="text-sm font-semibold text-foreground truncate max-w-xs">
          {title}
        </h1>
      )}
      {!title && <div />}

      <div className="flex items-center gap-3">
        <button
          onClick={() => setMagicOpen(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-semibold transition-all shadow-[0_0_15px_rgba(99,102,241,0.1)]"
        >
          ✨ Magic Add
        </button>

        <div className="relative">
          <button
            id="topbar-notifications"
            aria-label="Notificações"
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-9 h-9 rounded-xl bg-muted hover:bg-accent flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground relative"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifOpen(false)}
                  aria-hidden="true"
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  role="dialog"
                  aria-label="Notificações de Prazos"
                  className="absolute right-0 top-full mt-2 w-80 max-h-[400px] overflow-y-auto custom-scrollbar bg-card rounded-xl border border-border shadow-xl z-50"
                >
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between sticky top-0 bg-card/90 backdrop-blur-sm">
                    <h3 className="text-sm font-semibold text-foreground">Atenção Executiva</h3>
                    <span className="text-xs bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded-full font-medium">
                      {notifications.length} urgências
                    </span>
                  </div>

                  <div className="p-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Nenhuma demanda crítica ou vencendo nas próximas 48h.
                      </p>
                    ) : (
                      notifications.map(notif => {
                        const isOverdue = new Date(notif.due_date) < new Date();
                        return (
                          <div key={notif.id} className="p-3 hover:bg-accent rounded-lg transition-colors cursor-default border border-transparent hover:border-border/50">
                            <div className="flex items-start gap-2.5">
                              {isOverdue ? <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" /> : <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                              <div>
                                <p className="text-sm font-medium text-foreground leading-tight">{notif.title}</p>
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: notif.projects?.color }} />
                                  <span className="truncate max-w-[120px]">{notif.projects?.title}</span>
                                  <span className="opacity-50">•</span>
                                  <span className={isOverdue ? "text-rose-400 font-medium" : "text-amber-400 font-medium"}>
                                    {isOverdue ? 'Atrasado' : 'Vence breve'}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            id="topbar-user-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu do usuário"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl hover:bg-accent transition-colors group"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
              {initials}
            </div>
            <span className="text-sm text-foreground font-medium hidden sm:block max-w-[120px] truncate">
              {profile?.full_name ?? profile?.email ?? "Usuário"}
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                menuOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  role="menu"
                  aria-label="Opções do usuário"
                  className="absolute right-0 top-full mt-2 w-52 bg-card rounded-xl border border-border shadow-xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-xs text-muted-foreground">Conectado como</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {profile?.email}
                    </p>
                  </div>

                  <div className="p-1.5">
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/settings");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
                    >
                      <User className="w-4 h-4" />
                      Perfil
                    </button>

                    <button
                      id="topbar-logout"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
      <MagicAddModal open={magicOpen} onClose={() => setMagicOpen(false)} />
    </header>
  );
}
