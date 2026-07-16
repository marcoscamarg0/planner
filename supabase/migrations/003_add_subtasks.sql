alter table public.tasks
add column parent_task_id uuid references public.tasks(id) on delete cascade;

create index idx_tasks_parent_task_id on public.tasks(parent_task_id);
