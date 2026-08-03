-- Add parent_id to projects to support nested projects
alter table public.projects
add column parent_id uuid references public.projects(id) on delete cascade;

-- Create index for faster lookups of child projects
create index idx_projects_parent_id on public.projects(parent_id);
