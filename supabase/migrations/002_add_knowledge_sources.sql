-- Knowledge sources: links, PDFs and free text used as reference context for the AI assistant
create table if not exists public.knowledge_sources (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  type text not null check (type in ('link', 'pdf', 'text')),
  title text not null,
  source_url text,
  content text not null default '',
  created_at timestamptz default now() not null
);

create index if not exists knowledge_sources_owner_idx on public.knowledge_sources(owner_id);
create index if not exists knowledge_sources_project_idx on public.knowledge_sources(project_id);
create index if not exists knowledge_sources_created_idx on public.knowledge_sources(created_at desc);

alter table public.knowledge_sources enable row level security;

create policy "Users can view own knowledge sources" on public.knowledge_sources
  for select using (owner_id = auth.uid());

create policy "Users can create own knowledge sources" on public.knowledge_sources
  for insert with check (owner_id = auth.uid());

create policy "Users can delete own knowledge sources" on public.knowledge_sources
  for delete using (owner_id = auth.uid());
