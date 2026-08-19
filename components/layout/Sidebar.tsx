"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  TableProperties,
  FlaskConical,
  Settings,
  Calendar,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

interface NavGroup {
  title?: string;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    title: "PRINCIPAL",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/projects", label: "Projetos", icon: FolderKanban },
      { href: "/calendar", label: "Calendário", icon: Calendar },
      { href: "/organogram", label: "Organograma", icon: Network },
    ],
  },
  {
    title: "OPERAÇÕES & QA",
    items: [
      { href: "/qa", label: "Testes (QA)", icon: FlaskConical },
      { href: "/spreadsheet", label: "Planilhas", icon: TableProperties },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

interface SidebarProps {
  projects?: Project[];
  onNewProject?: () => void;
  onMoveProject?: (projectId: string, newParentId: string | null) => void;
}

export function Sidebar({}: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 260 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="hidden md:flex flex-col h-screen bg-card border-r border-border/80 sticky top-0 z-40 select-none will-change-[width]"
      aria-label="Navegação Principal"
    >
      {/* Header / Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4 shrink-0 border-b border-border/60",
          isCollapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-3 group outline-none"
          title="Planner — Ministério dos Transportes"
        >
          {/* Logo Badge */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-primary to-indigo-700 p-0.5 shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0C326F] dark:bg-[#0B132B] rounded-[10px] flex items-center justify-center relative overflow-hidden">
              {/* Brazil Flag Inspired Diamond */}
              <div className="w-4 h-4 bg-[#FFCC00] rotate-45 flex items-center justify-center shadow-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-[#0047FF] flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-white" />
                </div>
              </div>
            </div>
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-foreground font-heading">
                  Planner
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  MT
                </span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground truncate leading-tight">
                Min. dos Transportes
              </span>
            </div>
          )}
        </Link>

        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
            title="Recolher menu lateral"
            aria-label="Recolher menu lateral"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar" aria-label="Menu principal">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!isCollapsed && group.title && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-3 mb-2">
                {group.title}
              </p>
            )}

            <ul className="space-y-1" role="list">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center h-10 rounded-xl text-sm font-medium transition-all duration-150 group relative outline-none",
                        isCollapsed ? "justify-center px-0" : "px-3 gap-3",
                        isActive
                          ? "bg-primary/12 text-primary font-semibold shadow-2xs dark:bg-primary/18 dark:text-blue-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-indicator"
                          className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0 transition-colors",
                          isActive
                            ? "text-primary dark:text-blue-400"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {!isCollapsed && item.badge && (
                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/60 shrink-0">
        {isCollapsed ? (
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full flex items-center justify-center h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            title="Expandir menu lateral"
            aria-label="Expandir menu lateral"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#0C326F] flex items-center justify-center shrink-0 shadow-xs">
                <span className="text-[10px] font-black text-[#FFCC00]">BR</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground leading-none truncate">
                  Governo Federal
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight truncate mt-0.5">
                  Min. dos Transportes
                </span>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" title="Sistema online" />
          </div>
        )}
      </div>
    </motion.aside>
  );
}
