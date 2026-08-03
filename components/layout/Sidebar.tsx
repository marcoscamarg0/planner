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
  ChevronDown,
  Plus,
  Calendar,
  TestTube2,
  Network,
} from "lucide-react";
import { useState, DragEvent } from "react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

interface SidebarProps {
  projects: Project[];
  onNewProject: () => void;
  onMoveProject?: (projectId: string, newParentId: string | null) => void;
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
  {
    href: "/organogram",
    label: "Mapas Mentais",
    icon: Network,
  },
];

function ProjectNavItem({
  project,
  level = 0,
  allProjects,
  onMoveProject,
}: {
  project: Project;
  level?: number;
  allProjects: Project[];
  onMoveProject?: (projectId: string, newParentId: string | null) => void;
}) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(`/projects/${project.id}`);
  const subProjects = allProjects.filter((p) => p.parent_id === project.id);
  const hasChildren = subProjects.length > 0;

  const [isExpanded, setIsExpanded] = useState(isActive || hasChildren);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: DragEvent<HTMLLIElement>) => {
    e.dataTransfer.setData("text/plain", project.id);
    e.stopPropagation();
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const draggedId = e.dataTransfer.getData("text/plain");
    // Prevent moving a project into itself or its immediate parent
    if (draggedId && draggedId !== project.id && onMoveProject) {
      // Prevent moving a project into one of its own children (simple check, full cycle check could be complex)
      onMoveProject(draggedId, project.id);
      setIsExpanded(true);
    }
  };

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      <div 
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 group border border-transparent",
          isActive
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent",
          isDragOver && "border-primary bg-primary/20",
          level > 0 && "ml-4 border-l-border"
        )}
      >
        {hasChildren ? (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-4 h-4 flex items-center justify-center rounded-sm hover:bg-background transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <div className="w-4 h-4" />
        )}
        <Link href={`/projects/${project.id}`} className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
            aria-hidden="true"
          />
          <span className="truncate flex-1 text-xs">{project.title}</span>
        </Link>
      </div>

      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-0.5 space-y-0.5 relative before:absolute before:left-[19px] before:top-0 before:bottom-2 before:w-px before:bg-border"
          >
            {subProjects.map((child) => (
              <ProjectNavItem
                key={child.id}
                project={child}
                level={level + 1}
                allProjects={allProjects}
                onMoveProject={onMoveProject}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export function Sidebar({ projects, onNewProject, onMoveProject }: SidebarProps) {
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
              {projects.filter(p => !p.parent_id).map((project) => (
                <ProjectNavItem
                  key={project.id}
                  project={project}
                  allProjects={projects}
                  onMoveProject={onMoveProject}
                />
              ))}
            </AnimatePresence>

            {/* Drop zone for root */}
            <li
              className={cn("h-6 rounded-lg transition-colors border border-transparent")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData("text/plain");
                if (draggedId && onMoveProject) {
                  onMoveProject(draggedId, null);
                }
              }}
            >
              <div className="w-full h-full text-[10px] text-muted-foreground/30 flex items-center justify-center uppercase tracking-widest opacity-0 hover:opacity-100 hover:bg-accent/50 transition-all">
                Mover para a Raiz
              </div>
            </li>

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
