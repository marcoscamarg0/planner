"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  TestTube2,
  Zap,
  LineChart,
  Settings,
  HelpCircle,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const topNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projetos", icon: FolderKanban },
  { href: "/projects", label: "Tarefas", icon: CheckSquare },
  { href: "/projects", label: "Documentos", icon: FileText },
  { href: "/qa", label: "Testes (QA)", icon: TestTube2 },
  { href: "/dashboard", label: "Automações", icon: Zap },
  { href: "/dashboard", label: "Insights", icon: LineChart },
];

const bottomNavItems = [
  { href: "/dashboard", label: "Configurações", icon: Settings },
  { href: "/dashboard", label: "Ajuda", icon: HelpCircle },
  { href: "/dashboard", label: "Perfil", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 240 }}
      className="hidden md:flex flex-col h-screen bg-surface border-r border-border sticky top-0 z-40 transition-colors"
      aria-label="Main Navigation"
    >
      <div className={cn("flex items-center h-14 border-b border-border px-4", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm font-outfit text-foreground truncate">
              Planner
            </span>
          </div>
        )}
        {isCollapsed && (
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 flex flex-col" aria-label="Menu principal">
        <ul className="space-y-1" role="list">
          {topNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center h-9 rounded-md text-sm font-medium transition-all duration-200 group relative",
                    isCollapsed ? "justify-center px-0" : "px-3 gap-3",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto pt-4 space-y-1">
          <ul className="space-y-1" role="list">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center h-9 rounded-md text-sm font-medium transition-all duration-200 group relative",
                      isCollapsed ? "justify-center px-0" : "px-3 gap-3",
                      "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "w-full flex items-center h-9 rounded-md text-sm font-medium transition-all duration-200 group text-muted-foreground hover:text-foreground hover:bg-accent mt-2",
              isCollapsed ? "justify-center px-0" : "px-3 gap-3"
            )}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4 shrink-0" /> : <PanelLeftClose className="w-4 h-4 shrink-0" />}
            {!isCollapsed && <span className="truncate">Collapse</span>}
          </button>
        </div>
      </nav>
    </motion.aside>
  );
}
