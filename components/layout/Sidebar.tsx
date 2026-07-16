"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  Zap,
  ChevronRight,
  Plus,
  Calendar,
  TestTube2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

interface SidebarProps {
  projects: Project[];
  onNewProject: () => void;
}

const navItems = [
  {
    href: "/dashboard",
    label: "Painel Executivo",
    icon: LayoutDashboard,
  },
  {
    href: "/projects",
    label: "Projetos & Pautas",
    icon: FolderKanban,
  },
  {
    href: "/calendar",
    label: "Calendário de Prazos",
    icon: Calendar,
  },
  {
    href: "/qa",
    label: "Qualidade & Testes",
    icon: TestTube2,
  },
];

export function Sidebar({ projects, onNewProject }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col w-64 h-screen bg-card border-r border-border sticky top-0"
      aria-label="Navegação principal"
    >
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        <div>
          <span className="font-semibold text-foreground text-sm">Planner</span>
          <p className="text-xs text-muted-foreground leading-none mt-0.5">
            Workspace
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Menu principal">
        <ul className="space-y-0.5" role="list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    "group relative",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-6">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Projetos
            </span>
            <button
              id="sidebar-new-project"
              onClick={onNewProject}
              aria-label="Novo projeto"
              className="w-5 h-5 rounded-md bg-muted hover:bg-accent flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <ul className="space-y-0.5" role="list">
            <AnimatePresence>
              {projects.slice(0, 10).map((project) => {
                const isActive = pathname.startsWith(`/projects/${project.id}`);
                return (
                  <motion.li
                    key={project.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                  >
                    <Link
                      href={`/projects/${project.id}`}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 group",
                        isActive
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate flex-1">{project.title}</span>
                      <ChevronRight
                        className={cn(
                          "w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                          isActive && "opacity-100"
                        )}
                      />
                    </Link>
                  </motion.li>
                );
              })}
            </AnimatePresence>

            {projects.length === 0 && (
              <li>
                <button
                  onClick={onNewProject}
                  className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg"
                >
                  + Criar primeiro projeto
                </button>
              </li>
            )}
          </ul>
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            pathname === "/settings"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Configurações
        </Link>
      </div>
    </aside>
  );
}
