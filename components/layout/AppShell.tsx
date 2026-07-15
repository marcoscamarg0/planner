"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import type { Profile, Project } from "@/types";

interface AppShellProps {
  profile: Profile | null;
  projects: Project[];
  children: React.ReactNode;
}

export function AppShell({ profile, projects, children }: AppShellProps) {
  const [projectList, setProjectList] = useState<Project[]>(projects);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const router = useRouter();

  const handleProjectCreated = (project: Project) => {
    setProjectList((prev) => [project, ...prev]);
    setNewProjectOpen(false);
    router.push(`/projects/${project.id}`);
    router.refresh();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        projects={projectList}
        onNewProject={() => setNewProjectOpen(true)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar profile={profile} />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto pb-20 md:pb-0"
          role="main"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      <MobileNav />

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={handleProjectCreated}
      />
    </div>
  );
}
