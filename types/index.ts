export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ProjectRole = "owner" | "editor" | "viewer";
export type InsightType = "summary" | "suggestion" | "alert" | "progress";
export type KnowledgeSourceType = "link" | "pdf" | "text";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  color: string;
  emoji: string | null;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  content: Record<string, unknown> | null;
  icon: string | null;
  cover_url: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  page_id: string | null;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiInsight {
  id: string;
  project_id: string;
  page_id: string | null;
  content: string;
  type: InsightType;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  profile?: Profile;
}

export interface ProjectWithStats extends Project {
  total_tasks: number;
  completed_tasks: number;
  pages_count: number;
  last_insight?: AiInsight;
  members?: ProjectMember[];
}

export interface TaskGroupedByStatus {
  todo: Task[];
  in_progress: Task[];
  done: Task[];
  cancelled: Task[];
}

export interface KnowledgeSource {
  id: string;
  owner_id: string;
  project_id: string | null;
  type: KnowledgeSourceType;
  title: string;
  source_url: string | null;
  content: string;
  created_at: string;
}

export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  completed_tasks: number;
  total_tasks: number;
  completion_rate: number;
}
