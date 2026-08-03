-- Add flow_data to projects for React Flow test mapping
alter table public.projects
add column flow_data jsonb;
